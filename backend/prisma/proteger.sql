DO $$
DECLARE
  tabla RECORD;
BEGIN
  FOR tabla IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabla.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tabla.tablename);
  END LOOP;
END $$;
