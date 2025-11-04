-- ===========================
-- Extensions
-- ===========================
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ===========================
-- Configuration globale
-- ===========================
CREATE TABLE app_config (
    id SERIAL PRIMARY KEY,
    app_name TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    viewer_allowed BOOL DEFAULT FALSE,
    last_update TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ===========================
-- Personnes et Organisations
-- ===========================

CREATE TABLE person (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(30),
    UNIQUE (first_name, last_name)
);

CREATE TABLE organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    referent_id INT REFERENCES person(id)
);

-- ===========================
-- Lieux de stockage
-- ===========================

CREATE TABLE storage_location (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    address TEXT DEFAULT ''
);

-- ===========================
-- Style et genre
-- ===========================

CREATE TABLE reservable_style (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT ''
);

CREATE TYPE reservable_gender AS ENUM ('male', 'female', 'unisex');
CREATE TYPE privacy_type AS ENUM ('hidden', 'private', 'public');

-- ===========================
-- Catégories et Sous-catégories
-- ===========================

CREATE TABLE reservable_category (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT DEFAULT ''
);

CREATE TABLE reservable_subcategory (
    id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES reservable_category(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    UNIQUE (category_id, name)
);

-- ===========================
-- Types et Statuts
-- ===========================

CREATE TABLE reservable_type (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE reservable_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);


-- ===========================
-- Tailles
-- ===========================

CREATE TABLE size_type (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL UNIQUE      -- Exemple : 'Chaussure EU', 'Vêtement US', 'One-size'
);

CREATE TABLE size (
    id SERIAL PRIMARY KEY,
    size_type_id INT NOT NULL REFERENCES size_type(id),
    label TEXT NOT NULL,           -- '39', 'M', '40', etc.
    description TEXT DEFAULT '',   -- optionnel : précisions sur la taille
    UNIQUE(size_type_id, label)
);


-- ===========================
-- Objets réservable
-- ===========================

CREATE TABLE reservable (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type_id INT REFERENCES reservable_type(id),
    owner_id INT REFERENCES organization(id) NOT NULL,
    manager_id INT REFERENCES organization(id) NOT NULL,
    status_id INT REFERENCES reservable_status(id),
    storage_location_id INT REFERENCES storage_location(id),
    category_id INT REFERENCES reservable_category(id),
    subcategory_id INT REFERENCES reservable_subcategory(id),
    size_id INT REFERENCES size(id), 
    gender reservable_gender DEFAULT 'unisex',
    privacy privacy_type DEFAULT 'private',
    price_per_day NUMERIC(10,2) DEFAULT 0,
    description TEXT DEFAULT '',
    photos JSONB DEFAULT '[]'::jsonb
);

-- ===========================
-- Liens N:N : styles <-> objets
-- ===========================

CREATE TABLE reservable_style_link (
    reservable_id INT NOT NULL REFERENCES reservable(id) ON DELETE CASCADE,
    style_id INT NOT NULL REFERENCES reservable_style(id) ON DELETE CASCADE,
    PRIMARY KEY (reservable_id, style_id)
);

-- ===========================
-- Lots de costumes
-- ===========================

CREATE TABLE reservable_batch (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT DEFAULT '',
    owner_id INT REFERENCES organization(id) NOT NULL,
    manager_id INT REFERENCES organization(id) NOT NULL,
    status_id INT REFERENCES reservable_status(id)
);

-- Lien N:N : objets <-> lot
CREATE TABLE reservable_batch_link (
    batch_id INT NOT NULL REFERENCES reservable_batch(id) ON DELETE CASCADE,
    reservable_id INT NOT NULL REFERENCES reservable(id) ON DELETE CASCADE,
    PRIMARY KEY (batch_id, reservable_id)
);

-- ===========================
-- Booking reference (réservation externe)
-- ===========================

CREATE TABLE booking_reference (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT ''
);

-- ===========================
-- Réservations
-- ===========================

CREATE TABLE reservable_booking (
    id SERIAL PRIMARY KEY,
    reservable_batch_id INT REFERENCES reservable_batch(id) NOT NULL,
    renter_organization_id INT REFERENCES organization(id) NOT NULL,
    booking_reference_id INT REFERENCES booking_reference(id) NOT NULL,
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

CREATE OR REPLACE FUNCTION check_reservable_category_consistency()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.subcategory_id IS NOT NULL THEN
        PERFORM 1
        FROM reservable_subcategory s
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
BEFORE INSERT OR UPDATE ON reservable
FOR EACH ROW EXECUTE FUNCTION check_reservable_category_consistency();


-- ===========================
-- Index pour tables volumineuses
-- ===========================

-- Réservations sur lots
CREATE INDEX IF NOT EXISTS idx_reservable_booking_batch
    ON reservable_booking(reservable_batch_id);

-- Liens styles <-> objets
CREATE INDEX IF NOT EXISTS idx_style_link_reservable
    ON reservable_style_link(reservable_id);
CREATE INDEX IF NOT EXISTS idx_style_link_style
    ON reservable_style_link(style_id);

-- L’index GIST sur period gère déjà les chevauchements
CREATE INDEX IF NOT EXISTS idx_reservable_booking_batch_start
    ON reservable_booking(reservable_batch_id, start_date);

-- Autres index de filtrage
CREATE INDEX IF NOT EXISTS idx_reservable_booking_renter
    ON reservable_booking(renter_organization_id);
CREATE INDEX IF NOT EXISTS idx_reservable_booking_booking_ref
    ON reservable_booking(booking_reference_id);
CREATE INDEX IF NOT EXISTS idx_reservable_booking_start_end
    ON reservable_booking(start_date, end_date);
