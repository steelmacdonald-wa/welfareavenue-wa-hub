-- wa163c_phone_menu (29/09/26): the phone menu (wave163b). Steel: "the mobile layout of the menu at the bottom needs some
-- serious testing and redesign to make it more intuitive"; his choice: Home, Calendar, Ask, My team and Menu, with Menu
-- opening a full-screen sheet (Find a page, the apps, every section). Hub module 1 says where things are on a phone.
update public.trainings set description = replace(description,
  'Finance and the Admin centre.' || chr(10) || chr(10) || 'Try it: open My page',
  'Finance and the Admin centre. On a phone, the bar at the bottom has Home, the Calendar, Ask, your team and Menu: Menu opens everything, with Find a page at the top and the apps as tiles.' || chr(10) || chr(10) || 'Try it: open My page'),
  updated_at = now()
  where id = 39 and position('Finance and the Admin centre.' || chr(10) || chr(10) || 'Try it: open My page' in description) > 0 and position('On a phone, the bar at the bottom' in description) = 0;

insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
  values ('release', 'wave163b', 'hub_release', '9feedd1dd3d2b0dd14ae046fabf4c930', '6aca2aa3e9aaee3328098dedccab65a6 (the phone menu: Home, Calendar, Ask, My team and Menu; Menu opens a full-screen sheet with Find a page, the apps and every section, or the app''s own menu inside an app; the page you are on lights up; Ask the Hub opens full screen with the bar put away, so its message box can be reached)', 'wave163b');
