
-- Allow cutters to insert content pieces
CREATE POLICY "Cutters can insert content pieces"
ON public.content_pieces
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'cutter'));

-- Allow cutters to update any content piece (not just assigned)
DROP POLICY IF EXISTS "Cutters can update assigned content pieces" ON public.content_pieces;
CREATE POLICY "Cutters can update content pieces"
ON public.content_pieces
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'cutter'));

-- Allow cutters to delete content pieces
CREATE POLICY "Cutters can delete content pieces"
ON public.content_pieces
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'cutter'));
