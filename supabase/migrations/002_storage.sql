-- Run after creating the task-attachments bucket in Supabase Storage dashboard

-- Storage policies for authenticated users
CREATE POLICY storage_authenticated_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY storage_authenticated_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY storage_authenticated_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY storage_authenticated_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-attachments');
