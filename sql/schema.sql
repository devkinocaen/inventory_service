-- ===========================
-- Extensions
-- ===========================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ===========================
-- Schema metier
-- ===========================
CREATE SCHEMA IF NOT EXISTS inventory;

-- ===========================
-- Types
-- ===========================
CREATE TYPE inventory.reservable_gender AS ENUM ('male', 'female', 'unisex');
CREATE TYPE inventory.privacy_type AS ENUM ('hidden', 'private', 'public');
CREATE TYPE inventory.reservable_type AS ENUM ('costume', 'equipment');
CREATE TYPE inventory.reservable_status AS ENUM (
    'disponible', 'indisponible', 'en réparation', 'perdu', 'hors service'
);

-- ===========================
-- Configuration globale
-- ===========================
CREATE TABLE inventory.app_config (
    id SERIAL PRIMARY KEY,
    app_name TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    viewer_allowed BOOL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===========================
-- Personnes et Organisations
-- ===========================
CREATE TABLE inventory.person (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    UNIQUE (first_name, last_name)
);

CREATE TABLE inventory.organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    referent_id INT REFERENCES inventory.person(id)
);

-- ===========================
-- Lieux de stockage
-- ===========================
CREATE TABLE inventory.storage_location (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    address TEXT DEFAULT ''
);

-- ===========================
-- Style et genre
-- ===========================
CREATE TABLE inventory.reservable_style (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT ''
);

-- ===========================
-- Catégories et Sous-catégories
-- ===========================
CREATE TABLE inventory.reservable_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT ''
);

CREATE TABLE inventory.reservable_subcategory (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES inventory.reservable_category(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    UNIQUE (category_id, name)
);

-- ===========================
-- Tailles
-- ===========================
CREATE TABLE inventory.size_type (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE inventory.size (
    id SERIAL PRIMARY KEY,
    size_type_id INT NOT NULL REFERENCES inventory.size_type(id),
    label TEXT NOT NULL,
    description TEXT DEFAULT '',
    UNIQUE(size_type_id, label)
);

-- ===========================
-- Objets réservable
-- ===========================
CREATE TABLE inventory.reservable (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    inventory_type inventory.reservable_type NOT NULL,
    status inventory.reservable_status NOT NULL DEFAULT 'disponible',
    owner_id INT REFERENCES inventory.organization(id) NOT NULL,
    manager_id INT REFERENCES inventory.organization(id) NOT NULL,
    storage_location_id INT REFERENCES inventory.storage_location(id),
    category_id INT REFERENCES inventory.reservable_category(id),
    subcategory_id INT REFERENCES inventory.reservable_subcategory(id),
    size_id INT REFERENCES inventory.size(id),
    gender inventory.reservable_gender DEFAULT 'unisex',
    privacy inventory.privacy_type DEFAULT 'private',
    price_per_day NUMERIC(10,2) DEFAULT 0,
    description TEXT DEFAULT '',
    photos JSONB DEFAULT '[]'::jsonb
);

-- ===========================
-- Liens N:N : styles <-> objets
-- ===========================
CREATE TABLE inventory.reservable_style_link (
    reservable_id INT NOT NULL REFERENCES inventory.reservable(id) ON DELETE CASCADE,
    style_id INT NOT NULL REFERENCES inventory.reservable_style(id) ON DELETE CASCADE,
    PRIMARY KEY (reservable_id, style_id)
);

-- ===========================
-- Lots d'objets
-- ===========================
CREATE TABLE inventory.reservable_batch (
    id SERIAL PRIMARY KEY,
    description TEXT DEFAULT ''
);

CREATE TABLE inventory.reservable_batch_link (
    batch_id INT NOT NULL REFERENCES inventory.reservable_batch(id) ON DELETE CASCADE,
    reservable_id INT NOT NULL REFERENCES inventory.reservable(id) ON DELETE CASCADE,
    PRIMARY KEY (batch_id, reservable_id)
);

-- ===========================
-- Booking reference (réservation externe)
-- ===========================
CREATE TABLE inventory.booking_reference (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT ''
);

-- ===========================
-- Réservations
-- ===========================
CREATE TABLE inventory.reservable_booking (
    id SERIAL PRIMARY KEY,
    reservable_batch_id INT REFERENCES inventory.reservable_batch(id) NOT NULL,
    renter_organization_id INT REFERENCES inventory.organization(id) NOT NULL,
    booking_reference_id INT REFERENCES inventory.booking_reference(id) NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    period tsrange GENERATED ALWAYS AS (tsrange(start_date, end_date, '[]')) STORED,
    CHECK (end_date > start_date),
    EXCLUDE USING gist (
        reservable_batch_id WITH =,
        period WITH &&
    )
);

-- ===========================
-- Trigger de cohérence : catégorie / sous-catégorie
-- ===========================
CREATE OR REPLACE FUNCTION inventory.check_reservable_category_consistency()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.subcategory_id IS NOT NULL THEN
        PERFORM 1
        FROM inventory.reservable_subcategory s
        WHERE s.id = NEW.subcategory_id
          AND s.category_id = NEW.category_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Subcategory (id=%) does not belong to category (id=%)',
                NEW.subcategory_id, NEW.category_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_category_consistency
BEFORE INSERT OR UPDATE ON inventory.reservable
FOR EACH ROW EXECUTE FUNCTION inventory.check_reservable_category_consistency();

-- ===========================
-- Index pour tables volumineuses
-- ===========================
CREATE INDEX IF NOT EXISTS idx_reservable_booking_batch
    ON inventory.reservable_booking(reservable_batch_id);

CREATE INDEX IF NOT EXISTS idx_style_link_reservable
    ON inventory.reservable_style_link(reservable_id);
CREATE INDEX IF NOT EXISTS idx_style_link_style
    ON inventory.reservable_style_link(style_id);

CREATE INDEX IF NOT EXISTS idx_reservable_booking_batch_start
    ON inventory.reservable_booking(reservable_batch_id, start_date);

CREATE INDEX IF NOT EXISTS idx_reservable_booking_renter
    ON inventory.reservable_booking(renter_organization_id);

CREATE INDEX IF NOT EXISTS idx_reservable_booking_booking_ref
    ON inventory.reservable_booking(booking_reference_id);

CREATE INDEX IF NOT EXISTS idx_reservable_booking_start_end
    ON inventory.reservable_booking(start_date, end_date);
