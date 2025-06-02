-- Create the update_coupon_usage function
CREATE OR REPLACE FUNCTION public.update_coupon_usage(
  p_coupon_id uuid,
  p_increment boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon record;
BEGIN
  -- Get the coupon record
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;  -- Lock the row to prevent concurrent updates

  -- Check if the coupon exists
  IF v_coupon IS NULL THEN
    RAISE EXCEPTION 'Coupon with id % does not exist', p_coupon_id;
  END IF;

  -- Check if the coupon is active
  IF NOT v_coupon.active THEN
    RAISE EXCEPTION 'Coupon % is not active', p_coupon_id;
  END IF;

  -- Check if the coupon is expired
  IF v_coupon.valid_until < CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Coupon % has expired', p_coupon_id;
  END IF;

  IF p_increment THEN
    -- Check if incrementing would exceed max_uses
    IF v_coupon.uses >= v_coupon.max_uses THEN
      RAISE EXCEPTION 'Coupon % has reached its maximum uses', p_coupon_id;
    END IF;

    -- Increment the uses count
    UPDATE public.coupons
    SET uses = uses + 1
    WHERE id = p_coupon_id;
  ELSE
    -- Check if decrementing would go below 0
    IF v_coupon.uses <= 0 THEN
      RAISE EXCEPTION 'Coupon % usage count cannot go below 0', p_coupon_id;
    END IF;

    -- Decrement the uses count
    UPDATE public.coupons
    SET uses = uses - 1
    WHERE id = p_coupon_id;
  END IF;
END;
$$;

-- Revoke execute from public
REVOKE EXECUTE ON FUNCTION public.update_coupon_usage(uuid, boolean) FROM PUBLIC;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.update_coupon_usage(uuid, boolean) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.update_coupon_usage IS 'Updates the usage count of a coupon, with validation checks for existence, active status, and usage limits';