-- ===========================
-- Extensions
-- ===========================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ===========================
-- Schema metier
-- ===========================
CREATE SCHEMA IF NOT EXISTS inventory;
SET search_path = inventory, public;
-- ===========================
-- Types
-- ===========================
CREATE TYPE inventory.reservable_gender AS ENUM ('male', 'female', 'unisex');
CREATE TYPE inventory.privacy_type AS ENUM ('hidden', 'private', 'public');
CREATE TYPE inventory.reservable_type AS ENUM ('costume', 'equipment');
CREATE TYPE inventory.reservable_status AS ENUM (
    'disponible', 'indisponible', 'en réparation', 'perdu', 'hors service'
);

CREATE TYPE inventory.reservable_quality AS ENUM (
    'neuf', 'bon état', 'abîmé', 'très abîmé', 'inutilisable'
);

CREATE TYPE inventory.reservable_batch_status AS ENUM (
    'in_stock', 'out', 'mixed'
);

-- ===========================
-- Personnes et Organisations
-- ===========================
CREATE TABLE inventory.person (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    address VARCHAR(150),
    email VARCHAR(150),
    phone VARCHAR(30),
    UNIQUE (first_name, last_name)
);

CREATE TABLE inventory.organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    address VARCHAR(200),
    referent_id INT REFERENCES inventory.person(id) ON DELETE SET NULL
);

-- ===========================
-- Lien organisation ↔ personnes
-- ===========================
CREATE TABLE inventory.organization_person (
    organization_id INT NOT NULL REFERENCES inventory.organization(id) ON DELETE CASCADE,
    person_id INT NOT NULL REFERENCES inventory.person(id) ON DELETE CASCADE,
    role VARCHAR(100),  -- optionnel (ex : "costumier", "bénévole", "gestionnaire", etc.)
    PRIMARY KEY (organization_id, person_id)
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
-- Configuration globale
-- ===========================
CREATE TABLE inventory.app_config (
    id SERIAL PRIMARY KEY,
    app_name TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    viewer_allowed BOOL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    default_manager_id INT REFERENCES inventory.organization(id) ON DELETE SET NULL,
    default_owner_id INT REFERENCES inventory.organization(id) ON DELETE SET NULL,
    default_storage_location_id INT REFERENCES inventory.storage_location(id) ON DELETE SET NULL,
    show_prices BOOLEAN NOT NULL DEFAULT TRUE
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
--CREATE TABLE inventory.size_type (
--    id SERIAL PRIMARY KEY,
--    name TEXT NOT NULL UNIQUE
--);

--CREATE TABLE inventory.size (
--    id SERIAL PRIMARY KEY,
--    size_type_id INT NOT NULL REFERENCES inventory.size_type(id),
--    label TEXT NOT NULL,
--    description TEXT DEFAULT '',
--    UNIQUE(size_type_id, label)
--);

-- ===========================
-- Objets réservable
-- ===========================
CREATE TABLE inventory.reservable (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    inventory_type inventory.reservable_type NOT NULL,
    status inventory.reservable_status NOT NULL DEFAULT 'disponible',
    quality inventory.reservable_quality NOT NULL DEFAULT 'bon état',
    owner_id INT REFERENCES inventory.organization(id) NOT NULL,
    manager_id INT REFERENCES inventory.organization(id) NOT NULL,
    storage_location_id INT REFERENCES inventory.storage_location(id),
    category_id INT REFERENCES inventory.reservable_category(id),
    subcategory_id INT REFERENCES inventory.reservable_subcategory(id),
    size TEXT DEFAULT '',
    gender inventory.reservable_gender DEFAULT 'unisex',
    privacy inventory.privacy_type DEFAULT 'private',
    price_per_day double precision DEFAULT 0,
    description TEXT DEFAULT '',
    photos JSONB DEFAULT '[]'::jsonb,
    is_in_stock BOOLEAN NOT NULL DEFAULT TRUE
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

    -- Lot d'objets réservé
    reservable_batch_id INT NOT NULL
        REFERENCES inventory.reservable_batch(id)
        ON DELETE CASCADE,

    -- Organisation locataire
    renter_organization_id INT NOT NULL
        REFERENCES inventory.organization(id),

    -- Personne qui effectue la réservation (ex : costumière)
    booking_person_id INT
        REFERENCES inventory.person(id),

    -- Personne qui retire les objets
    pickup_person_id INT
        REFERENCES inventory.person(id),

    -- Personne qui les ramène
    return_person_id INT
        REFERENCES inventory.person(id),

    -- Référence du type de réservation (ex : prêt, location)
    booking_reference_id INT NOT NULL
        REFERENCES inventory.booking_reference(id),

    -- Période de réservation
    start_date TIMESTAMP NOT NULL,
    end_date   TIMESTAMP NOT NULL,
    
    -- Date de création de la réservation
    booked_at TIMESTAMP NOT NULL DEFAULT now(),

    -- Période temporelle (calculée)
    period tsrange GENERATED ALWAYS AS (tsrange(start_date, end_date, '[]')) STORED,

    -- Contraintes de cohérence
    CHECK (end_date > start_date),

    -- Empêche les réservations qui se chevauchent pour un même lot
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
