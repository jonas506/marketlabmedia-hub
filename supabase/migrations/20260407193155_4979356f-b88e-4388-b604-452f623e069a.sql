-- Drop the old restrictive policies
DROP POLICY IF EXISTS "Users can update own draft travel_expenses" ON public.travel_expenses;
DROP POLICY IF EXISTS "Users can delete own draft travel_expenses" ON public.travel_expenses;

-- Create new policies without status restriction
CREATE POLICY "Users can update own travel_expenses"
ON public.travel_expenses
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own travel_expenses"
ON public.travel_expenses
FOR DELETE
USING (auth.uid() = user_id);