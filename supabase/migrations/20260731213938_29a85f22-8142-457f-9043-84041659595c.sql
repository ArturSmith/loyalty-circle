CREATE POLICY "Business logos are readable by anyone"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'business-logos');

CREATE POLICY "Owners upload their business logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update their business logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete their business logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'business-logos' AND (storage.foldername(name))[1] = auth.uid()::text);