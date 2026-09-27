#!/usr/bin/env python3
"""wave150 (27/09/26): the Brand Guides in the Our brand Learning Avenue, with a hard knowledge check.
Steel: "https://drive.google.com/drive/folders/1HqAE-FHO2HRPvzpjhz8aGJpZLAbjIH8y This holds a folder to the branding
presentation which should be a part of the Our Brand training in Avenue Academy. I'd also like to make a hard quiz on our
brand." Asked: everyone, required; "5 tricky questions to test if they read it or not plus 10 basics to ensure they
remember important foundations of the brand".

Source: Welfare_Avenue_Brand_Guides_v1_2026.pdf (Drive 1gsd-eXAFfzJeblbMiIUJ0a2YoPeOkPay, Rebranding 2026 > 01. Assets),
read page by page (the PDF has no text layer). Page numbers below are the PDF's.

Writes build/data/wa150_brand.sql:
  - the Our brand avenue (academy_paths 'branding') becomes required for everyone, sits after the foundations, new blurb;
  - the Brand Guides as a document (doc:brand-guides), first in the avenue, with a reading guide;
  - the lesson Our brand: the essentials (lesson:brand) with a hard knowledge check of 15 questions (quiz.hard: shuffled
    every attempt, wrong answers point to the page instead of revealing the answer, 12 of 15 to pass);
  - the Brand Refresh video moves to the end of the avenue.

  python3 build/data/wa150_brand.py build/data/wa150_brand.sql
"""
import json, sys

OUT = sys.argv[1]
GUIDE_URL = 'https://drive.google.com/file/d/1gsd-eXAFfzJeblbMiIUJ0a2YoPeOkPay/view'
ASSETS_URL = 'https://drive.google.com/drive/folders/1HqAE-FHO2HRPvzpjhz8aGJpZLAbjIH8y'
IMG = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/brand/'
PATH = 'Branding'  # academy_paths.name for key 'branding' (title Our brand)

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def qj(o):
    return q(json.dumps(o, ensure_ascii=False)) + '::jsonb'

GUIDE_DESC = """The Brand Guides (version 1, 2026) are the source for how Welfare Avenue looks and sounds: 44 pages, about 25 minutes. Read it closely. Five of the fifteen questions in the knowledge check come from details that are only in the guide.

What to look for:

- Who we are (pages 4 to 8): our mission, vision and positioning, the four pillars, the brand evolution and our personality.
- Our personas (pages 9 to 11): the four audiences we speak to, and what each one needs.
- Brand archetypes (pages 12 to 18): the four personalities behind the brand.
- Logo (pages 19 to 25): the primary and secondary logos, breathing space, minimum sizes, and correct and incorrect uses.
- Typography (pages 26 to 29) and the colour palette (pages 30 and 31).
- How we speak (pages 32 to 34): the words we use, the ones we avoid, and the message for each audience.
- Doodles (pages 35 to 37) and the E that moves (pages 38 to 40).
- How it comes together (pages 41 to 43): social posts and printed pieces.

The logos, doodles, colours, fonts, profile pictures, meeting backgrounds, posters, printables and the E component are in [Rebranding 2026, 01. Assets](%s) on the shared drive.

Open it with your Welfare Avenue Google account. If the preview asks you to sign in or stays blank, use Open the document.

Done when: you have read every section, then take the lesson and its knowledge check (next in this avenue).""" % ASSETS_URL

LESSON = {
  'v': 1,
  'cover': 'gold',
  'summary': 'The essentials of the Welfare Avenue brand from the Brand Guides (2026): who we are, who we speak to, our personality, how we speak and how we look, then a hard knowledge check.',
  'chapters': [
    {'id': 'why', 't': 'Why the brand matters', 'blocks': [
      {'type': 'lead', 'text': 'Our brand is how people recognize Welfare Avenue and how they feel when they meet us: in a post, a flyer, an email or a conversation at a serving. Everyone who represents Welfare Avenue carries it, so everyone learns it.'},
      {'type': 'p', 'text': 'The **Brand Guides** (2026) are the source. This lesson covers the essentials; the guide has the details, page by page.'},
      {'type': 'quote', 'text': 'If you call it the wrong word, someone reading this gets the wrong image of what we do.', 'by': 'How we speak, Brand Guides'},
      {'type': 'callout', 'tone': 'warn', 't': 'About the knowledge check', 'text': 'It has 15 questions: 10 on the essentials in this lesson and 5 on details that are only in the Brand Guides, so read the guide first (it is the first item in this avenue). The questions and answers are shuffled for every attempt, a wrong answer points you to the page to check rather than showing the answer, and you need 12 right to pass.'}]},
    {'id': 'who', 't': 'Who we are', 'blocks': [
      {'type': 'quote', 'text': 'Welfare Avenue is a youth-powered non-profit dedicated to fighting food insecurity and poverty through direct community action, delivering meals and essential support directly to people where they are.', 'by': 'Our mission'},
      {'type': 'p', 'text': '**Our vision:** a world without poverty, where all individuals have the necessities they require and the opportunities available to them, and a society where community engagement is a central value from a young age.'},
      {'type': 'p', 'text': 'We are a youth-inspired community mobilization, active in Montreal and Toronto. Young leaders bring the energy and advocacy, and our doors are open to volunteers and partners of all generations.'},
      {'type': 'h', 'text': 'Our four pillars'},
      {'type': 'cards', 'items': [
        {'t': 'Food security mobilization', 'd': 'Consistent, coordinated food distribution that brings healthy meals to our unhoused neighbours, using the meal to build the trust that leads to long-term social reintegration.', 'icon': 'bowl'},
        {'t': 'Dignified resource distribution', 'd': 'Seasonal clothing, hygiene essentials and basic items, given directly to families and individuals facing economic hardship, always with respect and solidarity.', 'icon': 'gift'},
        {'t': 'Integrating the care ecosystem', 'd': 'A professional conduit between the trust we build on the street and long-term housing, mental health and employment support across our partners.', 'icon': 'handshake'},
        {'t': 'Dismantling social isolation', 'd': 'Community pop-ups, creative arts and recreational sports that break down social barriers, restore hope and build belonging.', 'icon': 'people'}]},
      {'type': 'h', 'text': 'Where the brand is going'},
      {'type': 'p', 'text': 'As Welfare Avenue grows, the brand grows with it. The brand evolution shifts us from a **food-focused non-profit** to a **broader community movement**: one that brings people together through action, connection and collective care. The goal is a more relevant, inclusive and recognizable brand that engages more people and amplifies our impact.'}]},
    {'id': 'audiences', 't': 'Who we speak to', 'blocks': [
      {'type': 'lead', 'text': 'The guide describes four personas. Each one hears the same mission, said for them.'},
      {'type': 'cards', 'items': [
        {'t': 'The community we serve', 'd': 'Olivier, 47, stands for the people we serve. Backgrounds differ, but many lost their stability to things outside their control and feel forgotten, judged and excluded. They look for support and a community that restores dignity and belonging. Speak with warmth, consistency and reassurance.', 'icon': 'heart', 'k': 'Restore dignity'},
        {'t': 'Volunteers', 'd': 'Sarah, 21, believes in social justice and wants to grow, learn and give, and to gain real professional skills. She is proud to see everyone face to face at Sunday servings. Make taking part feel meaningful, structured and empowering.', 'icon': 'people', 'k': 'Mobilize action'},
        {'t': 'Partners', 'd': 'Non-profits, charities and student associations aligned with our mission. They bring expertise, space and people. We present Welfare Avenue as a bridge within the existing care ecosystem.', 'icon': 'handshake', 'k': 'Build connection'},
        {'t': 'Sponsors', 'd': 'Local, medium to large organizations with corporate social responsibility goals, looking for a demonstrable social return. Speak in terms of scale, outcomes and professional credibility.', 'icon': 'target', 'k': 'Invest in impact'}]},
      {'type': 'note', 'text': 'Example sentences for each audience are on page 34 of the guide, and what each persona needs is on pages 10 and 11.'}]},
    {'id': 'personality', 't': 'Our personality', 'blocks': [
      {'type': 'lead', 'text': 'An archetype is a personality. It shapes every decision, so we do not just convey a message: we embody a relationship. Ours is a blend of four.'},
      {'type': 'cards', 'items': [
        {'t': 'The Everyman', 'd': 'Relevant, authentic and simple. Seeks belonging; values real connections and simplicity; fears exclusion and rejection.', 'icon': 'user', 'k': 'Think Jim Halpert'},
        {'t': 'The Caregiver', 'd': 'Altruist and protector. Cares for and helps others, with compassion, security and responsibility.', 'icon': 'heart', 'k': 'Think Mother Teresa'},
        {'t': 'The Hero', 'd': 'Courage and determination. Wants to do the impossible and leave a legacy, through strength, overcoming challenges and leadership.', 'icon': 'shield', 'k': 'Think Rocky Balboa'},
        {'t': 'The Innocent', 'd': 'Seeks happiness and harmony, and values kindness, honesty and simple, genuine experiences.', 'icon': 'sparkle', 'k': 'Think Forrest Gump'}]},
      {'type': 'p', 'text': 'The guide also places Welfare Avenue on ten personality sliders, from Traditional to Modern and from Serious to Fun. Look at page 8 to see where we sit: some of them may surprise you.'}]},
    {'id': 'voice', 't': 'How we speak', 'blocks': [
      {'type': 'lead', 'text': 'Warmth with purpose. The words we choose decide the picture people have of us and of the people we serve.'},
      {'type': 'compare', 'cols': [
        {'t': 'We say', 'tone': 'good', 'items': ['The people we serve, community, support', 'Support, dignity, connection, safety', 'Food as a starting point, refer, reintegrate', 'Youth-powered, professional, movement, future leaders', 'Collaborate, ecosystem, conduit, partnership', 'Impact, scalable, measurable, systemic change']},
        {'t': "We don't say", 'tone': 'bad', 'items': ['The homeless, beneficiaries, people in need', 'Pity, saving people, feeling sorry', 'Feed people, hand out food, give away snacks', 'Student club, just volunteers, small project', 'We do everything, we are the only ones', 'Donate, buy groceries, help us figure it out']}]},
      {'type': 'h', 'text': 'Why'},
      {'type': 'list', 'items': [
        '**Lead with the person, not their circumstance.** Our language protects dignity and creates belonging.',
        '**Solidarity, never pity.** We communicate solidarity and empowerment, never charity from a position of superiority.',
        '**Food is our conduit.** The meal builds trust; the larger goal is connection, dignity and social reintegration.',
        '**Youth is an asset.** We show energy and innovation with the discipline of a maturing organization.',
        '**We complement, we do not compete.** Our role is to connect people with the right support.',
        '**Outcomes, not inputs.** We talk about impact, which shows a credible organization built for growth.']},
      {'type': 'callout', 'tone': 'info', 't': 'The one exception', 'text': 'The guide has none, but formal filings like our CRA forms use beneficiaries because it is the legal term there. Everywhere else, we say the people we serve.'}]},
    {'id': 'look', 't': 'How we look', 'blocks': [
      {'type': 'lead', 'text': 'One logo family, five colours and two typefaces, used the same way everywhere.'},
      {'type': 'h', 'text': 'The logo'},
      {'type': 'figures', 'items': [
        {'src': IMG + 'logo-primary-green-600.png', 'bg': '#FFFAF2', 't': 'Primary logo', 'd': 'WELFARE AVENUE, stacked, with the E that moves in AVENUE. The default mark.', 'alt': 'The Welfare Avenue primary logo'},
        {'src': IMG + 'logo-secondary-cream-300.png', 'bg': '#103F39', 't': 'Secondary logo', 'd': 'WEL FAR E, the compact version for small and square spaces (pages 23 and 24).', 'alt': 'The Welfare Avenue secondary logo'},
        {'src': IMG + 'logo-lockup-cream-600.png', 'bg': '#103F39', 't': 'Logo with description', 'd': 'The logo with its descriptor line: **Building pathways in our community**.', 'alt': 'The Welfare Avenue logo with its descriptor line'}]},
      {'type': 'p', 'text': 'The guide sets the logo’s breathing space, its minimum sizes, the backgrounds that work and the uses we avoid (pages 21 to 25). Check them before you place the logo on anything.'},
      {'type': 'h', 'text': 'Our colours'},
      {'type': 'swatches', 'items': [
        {'n': 'Dignity', 'hex': '#FFFAF2', 'd': 'A warm foundation where people come first.', 'use': 'Backgrounds and text'},
        {'n': 'Community', 'hex': '#103F39', 'd': 'Rooted in connection and trust.', 'use': 'Backgrounds and text'},
        {'n': 'Ground', 'hex': '#1F201E', 'd': 'Clarity, structure and reliability.', 'use': 'Backgrounds and text'},
        {'n': 'Possibility', 'hex': '#6F64AB', 'd': 'Optimism for what comes next.', 'use': 'Accents, highlights, subtitles, extra text'},
        {'n': 'Action', 'hex': '#DCA527', 'd': 'Energy that moves people forward.', 'use': 'Accents, highlights, H2 and H3, extra text'}]},
      {'type': 'h', 'text': 'Our typefaces'},
      {'type': 'fonts', 'items': [
        {'f': 'Barlow Condensed', 'sample': 'Food is where connection begins', 'upper': True, 'role': 'Headlines, titles and display moments'},
        {'f': 'Space Grotesk', 'sample': 'We use food as a starting point to build trust, connect people with specialized support, and create pathways toward greater dignity and reintegration.', 'body': True, 'role': 'Body text, UI, captions and metadata'}]},
      {'type': 'list', 'items': [
        'Follow the 1.414 size scale and the weights it sets, in every medium.',
        'Never set body copy in Barlow Condensed.',
        'Never stretch, condense or skew either typeface.',
        'Never swap in look-alikes such as Times or Arial.']}]},
    {'id': 'extras', 't': 'Doodles and the E that moves', 'blocks': [
      {'type': 'lead', 'text': 'Keep it human. Our doodles add warmth, movement and personality: they should feel like a human hand showing up in the system.'},
      {'type': 'figures', 'items': [
        {'src': IMG + 'doodle-star-gold.png', 'bg': '#103F39', 't': 'Hand-drawn', 'd': 'Imperfect lines keep the brand human and approachable.', 'alt': 'A hand-drawn gold star'},
        {'src': IMG + 'doodle-heart-purple.png', 'bg': '#FFFAF2', 't': 'Expressive', 'd': 'Simple shapes bring emotion without over-explaining.', 'alt': 'A hand-drawn purple heart'},
        {'src': IMG + 'doodle-flowers-gold.png', 'bg': '#FFFAF2', 't': 'Playful', 'd': 'A touch of spontaneity reflects our youth-powered spirit.', 'alt': 'Hand-drawn gold flowers'},
        {'src': IMG + 'doodle-heart-chain-gold.png', 'bg': '#103F39', 't': 'Purposeful', 'd': 'Every doodle supports the message and never competes with it.', 'alt': 'A hand-drawn chain of gold hearts'}]},
      {'type': 'p', 'text': 'Use doodles to **frame** important content, **accent** headlines, numbers and calls to action, **connect** ideas with lines and gestures, and **layer** them with type, imagery and colour. The guide lists four things never to do with them on page 37.'},
      {'type': 'h', 'text': 'The E that moves'},
      {'type': 'figures', 'items': [
        {'src': IMG + 'e-large-green-600.png', 'bg': '#FFFAF2', 't': 'The E that moves', 'd': 'A typographic device that turns the E into a pathway for movement, connection and progress.', 'alt': 'The E that moves: an E with long extended bars'}]},
      {'type': 'steps', 'items': [
        {'t': 'Set the type', 'd': 'Start with the headline in Barlow Condensed and convert the text to outlines.'},
        {'t': 'Extend the bars', 'd': 'Select the E and drag its bars horizontally until they fit the layout.'},
        {'t': 'Let it move', 'd': 'Use the extended lines to create a sense of direction, connection or progression.'}]},
      {'type': 'p', 'text': 'Where to use it, and where not to, is on page 40 of the guide, with examples like TOGETHER WE MOVE FORWARD.'}]},
    {'id': 'work', 't': 'Putting it to work', 'blocks': [
      {'type': 'lead', 'text': 'You do not need to be a designer to get the brand right.'},
      {'type': 'cards', 'items': [
        {'t': 'Start from the real files', 'd': 'Logos, doodles, colours, fonts, profile pictures, meeting backgrounds, posters, printables and the E component are in Rebranding 2026, 01. Assets. Use those files rather than redrawing or screenshotting the logo.', 'icon': 'box'},
        {'t': 'Words first', 'd': 'Before you post, send or present, read your words against How we speak.', 'icon': 'chat'},
        {'t': 'Check the logo rules', 'd': 'Breathing space, minimum size and background: pages 21 to 25 of the guide.', 'icon': 'eye'},
        {'t': 'When in doubt, ask', 'd': 'Not sure something is on brand? Ask the marketing team, who look after it.', 'icon': 'megaphone'}]},
      {'type': 'links', 'items': [
        {'t': 'The Brand Guides (2026)', 'url': GUIDE_URL, 'd': 'The full guide, 44 pages'},
        {'t': 'Rebranding 2026, 01. Assets', 'url': ASSETS_URL, 'd': 'Logos, doodles, fonts, posters, printables and the E component'}]},
      {'type': 'callout', 'tone': 'info', 't': 'Done when', 'text': 'you can say our mission in your own words, use the right words for the people we serve, and place the logo, colours and type the way the guide sets them.'}]},
  ],
  'quiz': {
    'hard': True,
    'pass': 0.8,
    'source': 'doc:brand-guides',
    'title': 'The brand knowledge check',
    'intro': 'Ten questions cover the essentials in this lesson. Five test details that are only in the **Brand Guides**, so read the guide before you start.',
    'questions': [
      # ---- ten basics: the foundations every member should know ----
      {'q': 'Which of these is our mission, as the Brand Guides word it?',
       'a': ['Welfare Avenue is a youth-powered non-profit dedicated to fighting food insecurity and poverty through direct community action, delivering meals and essential support directly to people where they are.',
             'Welfare Avenue is a student club that hands out food to people in need every other Sunday.',
             'Welfare Avenue is a food bank that collects donations for families across Canada.',
             'Welfare Avenue is a national charity that funds other food programs through grants.'],
       'c': 0, 'why': 'That is the mission on the Who we are page. The others use words we avoid (student club, hands out food, people in need) or describe an organization we are not.',
       'hint': 'Who we are (page 5)', 'g': 'basic'},
      {'q': 'What does the brand evolution change?',
       'a': ['It shifts us from a food-focused non-profit to a broader community movement that brings people together through action, connection and collective care.',
             'It shifts us from a youth-powered movement to a traditional charity with a corporate look.',
             'It narrows our focus to food only, so the message stays simple.',
             'It gives us a new name so we can expand across Canada.'],
       'c': 0, 'why': 'The brand grows with the organization: from food-focused to a broader community movement, so it can engage more people and amplify our impact. Our name stays Welfare Avenue.',
       'hint': 'Brand evolution (page 7)', 'g': 'basic'},
      {'q': 'Which of these is NOT one of our four institutional pillars?',
       'a': ['Running emergency shelters', 'Dismantling social isolation', 'Integrating the care ecosystem', 'Dignified resource distribution'],
       'c': 0, 'why': 'The four pillars are food security mobilization, dignified resource distribution, integrating the care ecosystem and dismantling social isolation. Running shelters is not one of them: we build trust and connect people with partners for housing, mental health and employment support.',
       'hint': 'Institutional pillars (page 6)', 'g': 'basic'},
      {'q': 'Which four archetypes make up our brand personality?',
       'a': ['The Everyman, the Caregiver, the Hero and the Innocent',
             'The Rebel, the Magician, the Explorer and the Sage',
             'The Ruler, the Creator, the Lover and the Jester',
             'The Caregiver, the Ruler, the Sage and the Rebel'],
       'c': 0, 'why': 'The Everyman (belonging and real connection), the Caregiver (care for others), the Hero (courage and overcoming challenges) and the Innocent (kindness, honesty and genuine experiences).',
       'hint': 'Brand archetypes (pages 13 to 18)', 'g': 'basic'},
      {'q': 'Which sentence follows how we speak?',
       'a': ['Join a youth-powered movement connecting the people we serve with the support they need.',
             'Our student club hands out food to the homeless every other Sunday.',
             'Help us save people in need: donate today.',
             'We do everything for the less fortunate, because no one else will.'],
       'c': 0, 'why': 'It leads with the person (the people we serve), calls us a youth-powered movement and shows our role as the connection to support. The others use words or ideas from the We don’t say column: student club, hand out food, the homeless, saving people, people in need, donate, we do everything, we are the only ones.',
       'hint': 'How we speak (page 33)', 'g': 'basic'},
      {'q': 'In our language, what role does food play?',
       'a': ['A starting point: the meal builds trust, and the larger goal is connection, dignity and social reintegration.',
             'The whole mission: we feed people, and that is the job.',
             'A giveaway that brings people to our events.',
             'A fundraising tool: meals are how we attract donors.'],
       'c': 0, 'why': 'Food is our conduit. We say food as a starting point, refer and reintegrate, never feed people, hand out food or give away snacks.',
       'hint': 'How we speak (page 33)', 'g': 'basic'},
      {'q': 'Which pairing of typefaces is right?',
       'a': ['Barlow Condensed for headlines, titles and display; Space Grotesk for body text, UI, captions and metadata',
             'Space Grotesk for headlines; Barlow Condensed for body text',
             'Barlow Condensed for everything, so it stays consistent',
             'Arial for headlines and Times for body text when the brand fonts are not installed'],
       'c': 0, 'why': 'Barlow Condensed is for headlines, titles and display; Space Grotesk for body text, UI, captions and metadata. Never set body copy in Barlow Condensed, and never swap in look-alikes like Times or Arial.',
       'hint': 'Typography (pages 27 to 29)', 'g': 'basic'},
      {'q': 'What are our five brand colours called?',
       'a': ['Dignity, Community, Ground, Possibility and Action',
             'Hope, Growth, Earth, Dream and Energy',
             'Cream, Forest, Charcoal, Lavender and Mustard',
             'Trust, Care, Safety, Joy and Courage'],
       'c': 0, 'why': 'Dignity (#FFFAF2, the warm cream), Community (#103F39, the deep green), Ground (#1F201E, near-black), Possibility (#6F64AB, purple) and Action (#DCA527, gold). Each name says what the colour stands for.',
       'hint': 'Colour palette (page 31)', 'g': 'basic'},
      {'q': 'What is the descriptor line that sits under our logo?',
       'a': ['Building pathways in our community', 'Together we move forward', 'Small acts, real impacts, better futures', 'Youth-powered, community-driven'],
       'c': 0, 'why': 'The logo with description reads Building pathways in our community. Together we move forward and Small acts, real impacts, better futures are headlines from the guide’s social media examples.',
       'hint': 'Logo with description (page 22)', 'g': 'basic'},
      {'q': 'What are our doodles for?',
       'a': ['Adding warmth, movement and personality, with every doodle supporting the message rather than competing with it',
             'Filling empty space so a design never looks bare',
             'Replacing photos when we do not have any',
             'Replacing the logo on social media posts'],
       'c': 0, 'why': 'Keep it human: doodles are hand-drawn, expressive, playful and purposeful. They frame, accent, connect and layer, and each one needs a reason to be there.',
       'hint': 'Doodles (pages 36 and 37)', 'g': 'basic'},
      # ---- five details that only the guide has ----
      {'q': 'On the guide’s personality sliders, where does Welfare Avenue sit between Young and Mature?',
       'a': ['Leaning toward Mature', 'All the way to Young', 'Right in the middle', 'Leaning toward Young'],
       'c': 0, 'why': 'The Young to Mature dot sits two steps toward Mature, even though we are youth-powered. The only slider pushed all the way to one end is Luxurious to Popular, fully Popular.',
       'hint': 'The personality sliders (page 8)', 'g': 'detail'},
      {'q': 'According to the Sponsors persona, what do sponsors fear?',
       'a': ['Reputational risk and instability', 'Being asked for money too often', 'Their money going to overhead instead of programs', 'Having too little say in how programs run'],
       'c': 0, 'why': 'Sponsors are driven by corporate social responsibility goals and want a demonstrable social return. They fear reputational risk and instability, so they need a mature, structured partner.',
       'hint': 'Our personas: Sponsors (page 11)', 'g': 'detail'},
      {'q': 'How much clear space does the guide ask for around the logo?',
       'a': ['At least one E from the logo, on every side', 'The full height of the logo', 'One centimetre, whatever the logo’s size', 'None, as long as the logo is readable'],
       'c': 0, 'why': 'The breathing space is measured with the logo’s own E, marked x on page 21, on all four sides, so it grows and shrinks with the logo.',
       'hint': 'Logo breathing space (page 21)', 'g': 'detail'},
      {'q': 'Which of these does the guide show as an incorrect use of the logo?',
       'a': ['Adding a Santa hat or another prop to the logo for a holiday post',
             'The cream logo on the deep green (Community)',
             'The cream secondary logo, WEL FAR E, on gold (Action)',
             'The green logo on a calm, light area of a photo'],
       'c': 0, 'why': 'Props, low contrast, two-tone colours, outlines, rotation and busy photos are all under Incorrect applications. The other three are on the Correct applications page.',
       'hint': 'Correct and incorrect applications (pages 24 and 25)', 'g': 'detail'},
      {'q': 'Which of these is on the guide’s don’t list for the E that moves?',
       'a': ['Using it on every headline', 'Using it for major headlines', 'Keeping the E clearly recognizable', 'Using it to suggest progression'],
       'c': 0, 'why': 'Do: use it for major headlines, keep the E recognizable, let the extension interact with the layout, and use it to suggest progression. Don’t: use it in body copy or small type, stretch the entire word, or use it on every headline.',
       'hint': 'The E that moves, examples (page 40)', 'g': 'detail'},
    ]},
}

sql = []
sql.append("-- wave150: the Brand Guides and a hard knowledge check in the Our brand avenue (%s)" % 'generated by build/data/wa150_brand.py')
sql.append("update public.academy_paths set required = true, dept = null, sort = 15, blurb = %s where key = 'branding';"
           % q('The Brand Guides, the essentials of our brand and a hard knowledge check: who we are, how we speak and how we look. For everyone.'))
sql.append("insert into public.trainings (key, title, kind, category, path_group, description, resource_url, source, sort, minutes, xp, active, updated_at) values ('doc:brand-guides', 'The Brand Guides (2026)', 'doc', 'Welfare Avenue', %s, %s, %s, 'hub', 1, 25, 30, true, now())\n"
           "on conflict (key) where key is not null do update set title = excluded.title, kind = excluded.kind, category = excluded.category, path_group = excluded.path_group, description = excluded.description, resource_url = excluded.resource_url, sort = excluded.sort, minutes = excluded.minutes, xp = excluded.xp, active = true, updated_at = now();"
           % (q(PATH), q(GUIDE_DESC), q(GUIDE_URL)))
sql.append("insert into public.trainings (key, title, kind, category, path_group, description, source, sort, minutes, xp, active, body, updated_at) values ('lesson:brand', 'Our brand: the essentials and the knowledge check', 'lesson', 'Welfare Avenue', %s, %s, 'hub', 2, 20, 75, true, %s, now())\n"
           "on conflict (key) where key is not null do update set title = excluded.title, category = excluded.category, path_group = excluded.path_group, description = excluded.description, body = excluded.body, sort = excluded.sort, minutes = excluded.minutes, xp = excluded.xp, active = true, updated_at = now();"
           % (q(PATH), q(LESSON['summary']), qj(LESSON)))
sql.append("update public.trainings set sort = 3, updated_at = now() where id = 32 and path_group = %s;" % q(PATH))
# Hub module 7 (training and onboarding) says which avenues are required and how the hard check behaves
ANCHOR = 'HR manages onboarding and assigns trainings from the HR centre.'
ADD = ('Three Learning Avenues are required for everyone: Welfare Avenue foundations, Our brand and Using the Hub. The Our brand '
       'knowledge check is a hard one: its 15 questions come in a new order every attempt, a wrong answer points you to the page of '
       'the Brand Guides to check instead of showing the answer, and you see every answer once you pass (12 of 15).')
sql.append("update public.trainings set description = replace(description, %s, %s), updated_at = now() where id = 45 and position(%s in description) > 0 and position('Our brand knowledge check' in description) = 0;"
           % (q(ANCHOR), q(ANCHOR + '\n\n' + ADD), q(ANCHOR)))
sql.append("comment on column public.trainings.body is %s;" % q(
    "Lesson content as JSON; the shape depends on kind (tours: {tab, tour}; SOP lessons: {phases, roles, dayof, money, links, ...}; lessons: {chapters: [{id, t, blocks}], quiz: {pass, questions: [{q, a, c, why, hint}], hard, source, title, intro}}). "
    "Block types: lead, p, h, quote, stats, note, cards, activities, callout, compare, list, steps, link, links, kinds, partners, stages, and from wave150 swatches, figures (pictures from the Hub's own public storage only) and fonts. "
    "A quiz with hard true (wave150) shuffles its questions and answers every attempt, answers a wrong pick with the question's hint instead of the answer, and shows the answers once passed; source is the key of the training offered to reread."))
sql.append("insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('academy', 'wave150', 'branding', 'Our brand: marketing only, optional, 1 item', %s, 'wave150');"
           % q('Our brand: required for everyone; the Brand Guides (2026), the lesson Our brand: the essentials with a hard 15-question knowledge check (12 to pass), then the Brand Refresh video'))
open(OUT, 'w', encoding='utf8').write('\n\n'.join(sql) + '\n')
json.dump({'lesson': LESSON, 'guide_desc': GUIDE_DESC, 'guide_url': GUIDE_URL, 'module7_add': ADD}, open(OUT[:-4] + '.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)

# checks: shape, answers, and no long dashes anywhere in what people read
qs = LESSON['quiz']['questions']
assert len(qs) == 15 and sum(1 for x in qs if x['g'] == 'basic') == 10 and sum(1 for x in qs if x['g'] == 'detail') == 5
for x in qs:
    assert len(x['a']) == 4 and 0 <= x['c'] < 4 and x['why'] and x['hint'], x['q']
    assert len(set(x['a'])) == 4, x['q']
blob = json.dumps(LESSON, ensure_ascii=False) + GUIDE_DESC + ADD
assert '—' not in blob and '–' not in blob, 'long dash found'
print('ok: %d chapters, %d questions, %d bytes of SQL' % (len(LESSON['chapters']), len(qs), sum(len(s) for s in sql)))
