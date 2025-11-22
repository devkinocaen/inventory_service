-- ======================================
-- ======================================
-- 0. EXTENSIONS
-- ======================================
-- pgcrypto peut être utilisé, mais certaines bases managées préfèrent uuid-ossp
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================
-- 1. SCHEMA (pas de création de rôles sur Alwaysdata)
-- ======================================

-- 💡 Un seul utilisateur PostgreSQL existe (ex: "kinocaen")
-- Ces rôles sont simulés logiquement via la colonne "role" dans auth.users

CREATE SCHEMA IF NOT EXISTS auth;

-- ======================================
-- 2. TABLES USERS ET PROFILES
-- ======================================
DROP TABLE IF EXISTS auth.users CASCADE;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    encrypted_password TEXT NOT NULL,
    role TEXT DEFAULT 'authenticated',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

DROP TABLE IF EXISTS auth.user_profiles CASCADE;
CREATE TABLE auth.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    raw_user_meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- ======================================
-- 3. TRIGGERS
-- ======================================
CREATE OR REPLACE FUNCTION auth.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON auth.users;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.update_timestamp();

DROP TRIGGER IF EXISTS set_updated_at_profile ON auth.user_profiles;
CREATE TRIGGER set_updated_at_profile
BEFORE UPDATE ON auth.user_profiles
FOR EACH ROW
EXECUTE FUNCTION auth.update_timestamp();

-- Auto création du profil utilisateur
CREATE OR REPLACE FUNCTION auth.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
   INSERT INTO auth.user_profiles(user_id, raw_user_meta_data)
   VALUES (NEW.id, '{}'::jsonb);
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_created ON auth.users;
CREATE TRIGGER on_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auth.create_user_profile();


-- ======================================
-- 4. FONCTIONS UTILITAIRES
-- ======================================
-- 💡 Sur Alwaysdata, il n’y a pas de “request.jwt.claims” => on ajoute un fallback

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  WHERE current_setting('request.jwt.claim.sub', true) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '');
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.email', true), '');
$$;

CREATE OR REPLACE FUNCTION auth.jwt_sign(p_user_id uuid, p_role text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'MOCK_JWT_' || p_user_id || '_' || p_role;
END;
$$;

-- ======================================
-- 5. RLS (Row Level Security)
-- ======================================
-- 💡 Active le RLS, même si tout tourne sous un seul utilisateur PostgreSQL

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_own_user ON auth.users;
DROP POLICY IF EXISTS modify_own_user ON auth.users;

CREATE POLICY select_own_user ON auth.users
FOR SELECT USING (id = auth.uid());

CREATE POLICY modify_own_user ON auth.users
FOR UPDATE USING (id = auth.uid());

ALTER TABLE auth.user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_own_profile ON auth.user_profiles;
DROP POLICY IF EXISTS modify_own_profile ON auth.user_profiles;

CREATE POLICY select_own_profile ON auth.user_profiles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY modify_own_profile ON auth.user_profiles
FOR UPDATE USING (user_id = auth.uid());


-- ======================================
-- 6. LOGIN
-- ======================================
CREATE OR REPLACE FUNCTION public.login(p_email text, p_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  u auth.users%ROWTYPE;
  token text;
BEGIN
  SELECT * INTO u FROM auth.users WHERE email = p_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid login: user not found';
  END IF;

  IF u.encrypted_password <> p_password THEN
    RAISE EXCEPTION 'Invalid login: wrong password';
  END IF;

  token := public.jwt_sign(u.id, coalesce(u.role,'authenticated'));

  RETURN jsonb_build_object(
    'token', token,
    'user_id', u.id,
    'email', u.email,
    'role', u.role
  );
END;
$$;


-- ======================================
-- 7. TABLES PUBLIQUES & HOOK JWT
-- ======================================
DROP TABLE IF EXISTS public.roles CASCADE;
CREATE TABLE public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

INSERT INTO public.roles(name) VALUES
('dev'),('admin'),('prod'),('mag'),('lab'),('viewer');

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role select" ON public.roles
FOR SELECT USING (true);

DROP TABLE IF EXISTS public.user_profiles CASCADE;
CREATE TABLE public.user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id INT REFERENCES public.roles(id),
    created_at TIMESTAMP DEFAULT now()
);

-- Hook JWT (simulé)
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims jsonb;
BEGIN
  claims := event->'claims';
  IF claims->'app_metadata'->>'role' IS NULL THEN
    claims := jsonb_set(claims,'{app_metadata,role}','"prod"');
  END IF;
  event := jsonb_set(event,'{claims}',claims);
  RETURN event;
END;
$$;


-- ======================================
-- 8. FONCTION GET_USER_ROLE
-- ======================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    claims json;
    jwt_text text;
BEGIN
    jwt_text := current_setting('request.jwt.claims', true);

    IF jwt_text IS NULL OR jwt_text = '' THEN
        RETURN 'anonymous';
    END IF;

    claims := jwt_text::json;
    RETURN COALESCE(claims->'app_metadata'->>'role', 'anonymous');
END;
$$;


-- ======================================
-- 9. FONCTION GET_FUNCTION_PROTOTYPE
-- ======================================
CREATE OR REPLACE FUNCTION public.get_function_prototype(
    p_function_name TEXT,
    p_schema TEXT DEFAULT 'public'
)
RETURNS TABLE(
    function_name TEXT,
    schema_name TEXT,
    arguments TEXT,
    return_type TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT
        p.proname AS function_name,
        n.nspname AS schema_name,
        pg_get_function_identity_arguments(p.oid) AS arguments,
        t.typname AS return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE p.proname = p_function_name
      AND n.nspname = p_schema;
$$;


-- ======================================
-- 10. GRANTS (simplifiés)
-- ======================================
-- 💡 Pas de rôles multiples => tous les droits au propriétaire ("kinocaen")
-- 💡 Si besoin : accorder explicitement au propriétaire

GRANT ALL PRIVILEGES ON SCHEMA auth TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO PUBLIC;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA auth TO PUBLIC;
