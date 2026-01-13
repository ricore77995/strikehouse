-- Update kiosk PIN to 6 digits (default)
UPDATE gym_settings SET value = '123456' WHERE key = 'kiosk_pin' AND value = '1234';
