-- wa154_templates (28/09/26): the first email templates. Inner content only; mail-send wraps it in the brand layout
-- (green header band with the cream logo, cream body, green footer with the postal address, the charity number,
-- why they got it, and the unsubscribe link). {{name}} inserts a value, {{name|fallback}} falls back when empty.
-- <a class="btn"> becomes the gold button. Voice: wa-writing (warmth with purpose, people first, no em dashes).
insert into public.crm_email_templates (key, name, kind, subject, preheader, html_body, text_body, vars, sort, updated_by) values
('test', 'A test message', 'test', 'A test from the Welfare Avenue Hub', 'The Hub''s email engine, checking in.',
$html$<h1>The Hub can send email</h1>
<p>Hi {{first_name|there}},</p>
<p>This is a test message from the Welfare Avenue Hub. If it reached you, the sending domain, the brand template and the footer all work.</p>
<p>Nothing was sent to anyone else. Sends stay in test mode, to the team's own addresses, until the mode is switched to live in the CRM's Email tab.</p>
<a class="btn" href="{{hub_url|https://hub.welfareavenue.com}}#crm/email">Open the Email tab</a>$html$,
$text$Hi {{first_name|there}},

This is a test message from the Welfare Avenue Hub. If it reached you, the sending domain, the brand template and the footer all work.

Nothing was sent to anyone else. Sends stay in test mode, to the team's own addresses, until the mode is switched to live in the CRM's Email tab.$text$,
'["first_name","hub_url"]'::jsonb, 1, 'wave154'),

('welcome_volunteer', 'Welcome, new volunteer', 'transactional', 'Welcome to Welfare Avenue, {{first_name|friend}}', 'You just joined a youth-powered movement. Here is what happens next.',
$html$<h1>Welcome to Welfare Avenue</h1>
<p>Hi {{first_name|there}},</p>
<p>Thank you for joining a youth-powered movement that meets people where they are. Every Sunday our volunteers cook, drive and serve, and food is only the starting point: it opens the conversation that connects people with the support they need.</p>
<h2>What happens next</h2>
<ul>
<li>A member of our team will reach out with the next serving dates and your first shift.</li>
<li>You will meet your team leader on the day. No experience needed; we show you everything.</li>
<li>Questions before then? Reply to this email. We read every one.</li>
</ul>
<a class="btn" href="{{site_url|https://welfareavenue.com}}">See the upcoming servings</a>
<p>See you soon,<br>The Welfare Avenue team</p>$html$,
$text$Hi {{first_name|there}},

Thank you for joining a youth-powered movement that meets people where they are. Every Sunday our volunteers cook, drive and serve, and food is only the starting point: it opens the conversation that connects people with the support they need.

What happens next
- A member of our team will reach out with the next serving dates and your first shift.
- You will meet your team leader on the day. No experience needed; we show you everything.
- Questions before then? Reply to this email. We read every one.

See you soon,
The Welfare Avenue team$text$,
'["first_name","site_url"]'::jsonb, 10, 'wave154'),

('thank_you_gift', 'Thank you for a gift', 'transactional', 'Thank you, {{first_name|friend}}', 'Your gift is already at work in our community.',
$html$<h1>Thank you</h1>
<p>Hi {{first_name|there}},</p>
<p>Your gift of <strong>{{amount}}</strong>{{gift_date_line}} is already at work. It puts meals on the table this Sunday, and it keeps our youth-powered teams on the street, building the trust that connects people with housing, health and the services they are owed.</p>
<p>{{receipt_note|Your official tax receipt follows separately.}}</p>
<p>With gratitude,<br>The Welfare Avenue team</p>$html$,
$text$Hi {{first_name|there}},

Your gift of {{amount}}{{gift_date_line}} is already at work. It puts meals on the table this Sunday, and it keeps our youth-powered teams on the street, building the trust that connects people with housing, health and the services they are owed.

{{receipt_note|Your official tax receipt follows separately.}}

With gratitude,
The Welfare Avenue team$text$,
'["first_name","amount","gift_date_line","receipt_note"]'::jsonb, 20, 'wave154'),

('serving_reminder', 'Reminder before a serving', 'transactional', 'See you {{event_day|soon}}: {{event_title|our next serving}}', 'Where to be, when, and what to bring.',
$html$<h1>See you {{event_day|soon}}</h1>
<p>Hi {{first_name|there}},</p>
<p>A quick reminder: you are down as <strong>{{role|a volunteer}}</strong> for <strong>{{event_title|our next serving}}</strong>.</p>
<ul>
<li><strong>When:</strong> {{event_when|see the serving details}}</li>
<li><strong>Where:</strong> {{event_location|the usual meeting point}}</li>
<li><strong>Bring:</strong> comfortable shoes, a warm layer and your energy. We take care of the rest.</li>
</ul>
<p>Can't make it? Reply to this email so your team leader can plan around it.</p>
<a class="btn" href="{{site_url|https://welfareavenue.com}}">Serving details</a>$html$,
$text$Hi {{first_name|there}},

A quick reminder: you are down as {{role|a volunteer}} for {{event_title|our next serving}}.

When: {{event_when|see the serving details}}
Where: {{event_location|the usual meeting point}}
Bring: comfortable shoes, a warm layer and your energy. We take care of the rest.

Can't make it? Reply to this email so your team leader can plan around it.$text$,
'["first_name","role","event_title","event_day","event_when","event_location","site_url"]'::jsonb, 30, 'wave154'),

('newsletter', 'Newsletter', 'newsletter', '{{subject|News from Welfare Avenue}}', '{{preheader|What your support made possible this month.}}',
$html$<h1>{{headline|What we did together}}</h1>
{{body_html|<p>The month's stories go here: the people we served, the volunteers who showed up, and what comes next.</p>}}
<a class="btn" href="{{cta_url|https://welfareavenue.com}}">{{cta_label|Read more}}</a>$html$,
$text${{headline|What we did together}}

{{body_text|The month's stories go here.}}

{{cta_label|Read more}}: {{cta_url|https://welfareavenue.com}}$text$,
'["subject","preheader","headline","body_html","body_text","cta_url","cta_label"]'::jsonb, 40, 'wave154')
on conflict (key) do nothing;
