-- Check what RPC functions are available
SELECT 
    routines.routine_name,
    routines.routine_type,
    parameters.parameter_name,
    parameters.data_type
FROM information_schema.routines 
LEFT JOIN information_schema.parameters ON routines.specific_name = parameters.specific_name
WHERE routines.routine_schema = 'public' 
  AND routines.routine_name LIKE '%authenticate%'
ORDER BY routines.routine_name, parameters.ordinal_position;