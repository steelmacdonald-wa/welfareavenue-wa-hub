-- wa191g_stage_search_path (01/10/26): the security advisor flagged wa191_stage (wave191) with a role-mutable search_path; it only uses built-ins.
alter function public.wa191_stage(date, text) set search_path to '';
