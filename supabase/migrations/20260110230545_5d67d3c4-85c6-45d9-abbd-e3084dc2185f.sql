-- Drop and recreate the view to include area capacity
DROP VIEW IF EXISTS v_today_rentals;

CREATE VIEW v_today_rentals AS
SELECT 
    r.id,
    r.coach_id,
    r.area_id,
    r.rental_date,
    r.start_time,
    r.end_time,
    r.is_recurring,
    r.series_id,
    r.guest_count,
    r.fee_charged_cents,
    r.status,
    r.credit_generated,
    r.created_at,
    r.created_by,
    r.cancelled_at,
    r.cancelled_by,
    c.nome AS coach_nome,
    c.modalidade,
    a.nome AS area_nome,
    a.capacidade_pts AS area_capacidade
FROM rentals r
JOIN external_coaches c ON r.coach_id = c.id
JOIN areas a ON r.area_id = a.id
WHERE r.rental_date = CURRENT_DATE;