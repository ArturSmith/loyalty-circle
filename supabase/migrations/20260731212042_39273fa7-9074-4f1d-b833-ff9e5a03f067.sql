DROP POLICY IF EXISTS "Avatars readable by authenticated" ON storage.objects;

CREATE POLICY "Avatars readable by owner or related party"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.card_instances ci
      JOIN public.card_templates t ON t.id = ci.template_id
      JOIN public.businesses b ON b.id = t.business_id
      WHERE (
        (b.owner_id = auth.uid() AND ci.customer_id::text = (storage.foldername(name))[1])
        OR (ci.customer_id = auth.uid() AND b.owner_id::text = (storage.foldername(name))[1])
      )
    )
  )
);