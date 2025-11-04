-- ============================================================
-- Script : insert_costumes_constants.sql
-- Description : Constantes initiales pour la base "reservable" (focus Costumes)
-- ============================================================

-- ===========================================
-- Configuration globale
-- ===========================================
INSERT INTO app_config (app_name, schema_version)
VALUES ('Costumerie', '0.1.0')
ON CONFLICT DO NOTHING;

-- ===========================================
-- Organisations par défaut
-- ===========================================
INSERT INTO organization (name)
VALUES
  ('Kino Caen'),
  ('Amavada')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Lieux de stockage
-- ===========================================
INSERT INTO storage_location (name, address)
VALUES
  ('Koenig'),
  ('Costumerie Amavada'),
  ('Maison de l''asso Kinocaen')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Types d’objets réservables
-- ===========================================
INSERT INTO reservable_type (name)
VALUES
  ('Costume')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Statuts des objets
-- ===========================================
INSERT INTO reservable_status (name)
VALUES
  ('disponible'),
  ('indisponible'),
  ('en réparation'),
  ('perdu'),
  ('hors service')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Types de tailles
-- ===========================================
INSERT INTO size_type (name)
VALUES
  ('Âge'),          -- bébé / 4 - 6 ans / 8 - 10 ans / adulte...
  ('Vêtement EU'),  -- tailles standard européennes (36, 38, 40…)
  ('Vêtement US'),  -- tailles US (XS, S, M, L…)
  ('Chaussure EU'), -- pointure européenne
  ('Chaussure US')  -- pointure américaine
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Styles visuels (époques principales et usages, centrés sur la France)
-- ===========================================
INSERT INTO reservable_style (name, description)
VALUES
  ('Antique', 'Costumes inspirés de l’Antiquité gréco-romaine ou égyptienne'),
  ('Médiéval', 'Tenues du Moyen Âge français : chevaliers, nobles, paysans, religieux'),
  ('Renaissance à Ancien Régime', 'Costumes des XVe–XVIIIe siècles : Renaissance, baroque, Louis XIV, Louis XV, Louis XVI'),
  ('Révolution & Empire', 'Période 1789–1815 : Révolution française, Directoire, Empire napoléonien'),
  ('XIXe siècle & IIIe République', 'De la Restauration à 1914 : mode romantique, Second Empire, Belle Époque, débuts de la IIIe République, bourgeoisie et ouvriers'),
  ('Première Guerre mondiale', 'Uniformes et vêtements civils 1914–1918'),
  ('Seconde Guerre mondiale', 'Uniformes, résistants, civils 1939–1945'),
  ('Années 1950–2000', 'Époques modernes : années 50 à 2000'),
  ('Fantastique', 'Univers imaginaires, fantasy, théâtre, conte'),
  ('Urbain', 'Mode contemporaine, rue, décontracté'),
  ('Professionnel', 'Uniformes, métiers, travail'),
  ('Spectacle', 'Costumes de scène, cabaret, cirque'),
  ('Classique', 'Tenues intemporelles, habillées ou neutres')
ON CONFLICT (name) DO NOTHING;


-- ===========================================
-- Catégories principales (Costumerie)
-- ===========================================
INSERT INTO reservable_category (name, description)
VALUES
  ('Robes & Tenues', 'Vêtements et ensembles pour costumes'),
  ('Hauts', 'Chemises, pulls, vestes, gilets'),
  ('Bas', 'Pantalons, jupes, shorts'),
  ('Chaussures', 'Bottes, talons, souliers, sneakers'),
  ('Chapeaux & Coiffes', 'Chapeaux, casquettes, perruques'),
  ('Accessoires', 'Bijoux, ceintures, gants, lunettes, foulards'),
  ('Uniformes', 'Uniformes militaires, scolaires ou professionnels')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- Sous-catégories par catégorie
-- ===========================================
-- Robes & Tenues
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (1, 'Robe'),
  (1, 'Combinaison / Salopette'),
  (1, 'Tenue complète'),
  (1, 'Cape / Mantelet'),
  (1, 'Tunique'),
  (1, 'Autre tenue')
ON CONFLICT (category_id, name) DO NOTHING;

-- Hauts
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (2, 'Chemise / Blouse'),
  (2, 'Pull / Sweat'),
  (2, 'Veste / Blazer'),
  (2, 'Gilet'),
  (2, 'Manteau / Veste longue'),
  (2, 'Autre haut')
ON CONFLICT (category_id, name) DO NOTHING;

-- Bas
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (3, 'Pantalon / Jean'),
  (3, 'Jupe'),
  (3, 'Short / Bermuda'),
  (3, 'Collants / Legging'),
  (3, 'Autre bas')
ON CONFLICT (category_id, name) DO NOTHING;

-- Chaussures
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (4, 'Bottes'),
  (4, 'Talons'),
  (4, 'Souliers / Mocassins'),
  (4, 'Sneakers / Baskets'),
  (4, 'Sandales / Tongs'),
  (4, 'Chaussures de scène / spéciales')
ON CONFLICT (category_id, name) DO NOTHING;

-- Chapeaux & Coiffes
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (5, 'Chapeau'),
  (5, 'Casquette / Béret'),
  (5, 'Perruque'),
  (5, 'Coiffe / Voilette'),
  (5, 'Casque / Heaume'),
  (5, 'Accessoire de tête divers')
ON CONFLICT (category_id, name) DO NOTHING;

-- Accessoires
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (6, 'Bijou / Collier / Bracelet'),
  (6, 'Ceinture / Écharpe'),
  (6, 'Gants / Mitaines'),
  (6, 'Lunettes / Masque'),
  (6, 'Foulard / Boa'),
  (6, 'Autre accessoire')
ON CONFLICT (category_id, name) DO NOTHING;

-- Uniformes
INSERT INTO reservable_subcategory (category_id, name)
VALUES
  (7, 'Militaire'),
  (7, 'École / Étudiant'),
  (7, 'Professionnel / Travail'),
  (7, 'Officiel / Gouvernemental'),
  (7, 'Scène / Théâtre'),
  (7, 'Autre uniforme')
ON CONFLICT (category_id, name) DO NOTHING;

-- ===========================================
-- Booking references
-- ===========================================
INSERT INTO booking_reference (name, description)
VALUES
  ('Location externe', 'Réservation effectuée par un organisme externe'),
  ('Prêt interne', 'Utilisation interne à l’association'),
  ('Maintenance', 'Réparation, nettoyage ou ajustement'),
  ('Événement', 'Défilé, tournage, représentation, etc.')
ON CONFLICT (name) DO NOTHING;

-- ===========================================
-- DONE ✅
-- ===========================================
