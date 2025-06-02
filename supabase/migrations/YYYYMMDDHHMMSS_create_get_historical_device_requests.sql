create or replace function get_historical_device_requests_with_user_info()
returns table (
    id bigint,
    user_id uuid,
    fingerprint text,
    status text, -- Changed from request_status to text
    requested_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by uuid,
    user_description text,
    admin_notes text,
    users jsonb -- To store user name and email
)
language plpgsql
as $$
begin
    return query
    select
        dar.id,
        dar.user_id,
        dar.fingerprint,
        dar.status,
        dar.requested_at,
        dar.reviewed_at,
        dar.reviewed_by,
        dar.user_description,
        dar.admin_notes,
        jsonb_build_object(
            'name', u.name,
            'email', u.email
        ) as users
    from
        public.device_authorization_requests dar
    left join
        public.users u on dar.user_id = u.id 
    where
        dar.status in ('approved', 'denied')
    order by
        dar.reviewed_at desc nulls last, dar.requested_at desc;
end; 
$$; 