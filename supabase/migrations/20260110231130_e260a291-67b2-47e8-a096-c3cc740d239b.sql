-- Allow partners to insert their own rentals
CREATE POLICY "Partner can insert own rentals" 
ON public.rentals 
FOR INSERT 
WITH CHECK (coach_id = get_staff_coach_id(auth.uid()));

-- Allow partners to update their own rentals (for cancellation)
CREATE POLICY "Partner can update own rentals" 
ON public.rentals 
FOR UPDATE 
USING (coach_id = get_staff_coach_id(auth.uid()));