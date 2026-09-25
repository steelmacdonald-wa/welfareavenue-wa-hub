# wave116k: job description links + main responsibilities per team member (from the HR shared drive JDs)
import json
D = lambda i: 'https://docs.google.com/document/d/%s/edit' % i
F = lambda i: 'https://drive.google.com/file/d/%s/view' % i
FUND = D('1xqWGVamvgvirrog8xLhgytHUig134arUkAk1VXMQEL0')
ED = D('1TVSg05HIQo53fSCGnaer4J6fOQ_WQW7cWIoUk6nYaWM')
PDC = D('1ClLosCiFPtjcDpM7nFN0FOZEoFBq_3odzvmBfvhVuS8')
CDEV = D('10FhwR01jyX0TELDXtrT0tpJPWg9g5Ps3HU2NFzVnj7M')
CDES = D('1dy9T7hDX2b9WLhfxoGUEg7cmnScoxoT45qXzVhazzUs')
TOA = F('1vpetO2yOqQRyFhgASf3DFVcoYWFOyOqT')
OA = F('1b8AoutJ4Oib0hBp6z32nhf2s0YA7Rl4_')
MD = F('12_uMdykkbj5rD81eh81VP_S8zaadDK7t')
MAL = D('14OJi_Qjbkaj7xXeA9MhyCgtILIheAfG23808sM1WrTo')
ROWS = [
 # id, jd_url, jd_name, responsibilities
 (37, ED, "Welfare Avenue's Executive Directors Job Description", [
   "Strategic leadership: the strategic plan with the board, and leading the director team",
   "Board governance as President: agendas, reporting, recommendations and board development",
   "Financial oversight: budgets, planning and reporting, with the Co-ED and the treasurer",
   "Fundraising and resource development: donors, sponsors, grants and events",
   "External relations: primary spokesperson with partners, funders and the community"]),
 (38, ED, "Welfare Avenue's Executive Directors Job Description", [
   "Co-leads Welfare Avenue as Co-Executive Director, based in Toronto",
   "Leads the grants stream: funder research, proposals and reporting",
   "Oversees Toronto operations with the Regional Director of Ontario",
   "Executive owner for HR and Finance decisions",
   "Serves on the board as Member-at-Large"]),
 (39, F('1_qb8AvkczAt8X2wbwdwLmCduQRJdEoSz'), "President/Chair Job Description", [
   "Chairs and facilitates board meetings",
   "Sets the board agenda with the executive directors",
   "Keeps decisions, minutes and follow-ups moving between meetings"]),
 (40, MAL, "Member At Large", [
   "Attends board meetings and votes on governance and financial decisions",
   "Reviews board materials ahead of each meeting",
   "Serves on committees and supports the executive team where asked"]),
 (41, MAL, "Member At Large", [
   "Attends board meetings and votes on governance and financial decisions",
   "Reviews board materials ahead of each meeting",
   "Serves on committees and supports the executive team where asked"]),
 (27, FUND, "Fundraising Event Manager (Fundraising Team Structure - JDs, 3.2)", [
   "Owns the annual fundraising event calendar: strategy, scheduling and new recurring events",
   "Leads Flag Football, the Holiday Gift Basket Drive and the Rally Paper end to end",
   "Cultivates warm-pipeline sponsors and leads partner communication (Poulet Rouge, Sportira, clubs)",
   "Manages event budgets and tracks event revenue against fundraising goals",
   "Manages and coaches the Fundraising Event Coordinators"]),
 (29, FUND, "Fundraising Event Coordinator (Fundraising Team Structure - JDs, 3.3)", [
   "Lays out logistics for each event: venue, equipment, signage, supplies and schedule",
   "Builds and maintains the day-of run-of-show for every event",
   "Coordinates vendors and external service providers",
   "Liaises with Operations for volunteer staffing and briefs volunteers on event day",
   "Supervises on-the-ground event operations and troubleshoots in real time"]),
 (30, FUND, "Donor Acquisition & Communications Lead (Fundraising Team Structure - JDs, 3.6)", [
   "Builds and leads the volunteer Donor Ambassador team",
   "Face-to-face donor acquisition on campus, at events and in the community",
   "Owns donor onboarding and first-year stewardship",
   "Keeps the donor communication cadence: newsletter contributions and gratitude moments",
   "Front-line donor presence at fundraising events"]),
 (28, FUND, "Outreach & Partnerships Manager (Fundraising Team Structure - JDs, 3.1)", [
   "Co-leads the fundraising department with the Event Manager",
   "Owns the sponsorship pipeline (warm and cold)",
   "Strategy and oversight for the recurring donor program",
   "Campus brand presence and university partnerships",
   "External representation at conferences"]),
 (31, FUND, "Donor Engagement & Outreach Specialist (Fundraising Team Structure - JDs, 3.5)", [
   "Donor stewardship and retention for existing donors",
   "Multilingual community outreach (EN/FR/ES)",
   "Donor data hygiene and reporting",
   "Impact report drafting",
   "Donor presence at fundraising events"]),
 (33, D('1OSXzT_YE6qWwbs4IFk-QlCdcUldMRcMz0ijU__qHP9Y'), "Grant Coordinator", [
   "Researches grant opportunities (foundations, corporations, government, PHAC) and keeps the grants database current",
   "Writes and submits proposals, letters of intent and applications",
   "Works with the executive team and program leads on narratives and budgets",
   "Tracks submitted proposals and prepares funder reports",
   "Prioritises grants that fund programs and paid staff capacity"]),
 (32, D('130NWastC7iCzizstEkWLfqra-WAveoRySk2vm4xgNr8'), "CFO Job Description", [
   "Oversees day-to-day financial operations and the books",
   "Financial planning, budgets and forecasts with the executive team",
   "Monitors cash flow across departments",
   "Financial reporting to the executive team and the board (treasurer)",
   "Grant compliance and funder financial reporting"]),
 (34, None, None, [
   "Leads the HR team: recruitment, onboarding and offboarding across departments",
   "Owns internal policies and the HR standard operating procedures",
   "Runs performance and discipline follow-ups with department leads",
   "Keeps the roster, job descriptions and role changes current"]),
 (35, None, None, [
   "Plans virtual socials and team engagement moments",
   "Supports onboarding and check-ins for new members",
   "Helps the HR lead with recruitment communications"]),
 (36, None, None, [
   "Reviews and updates job descriptions with department leads",
   "Runs onboarding for new team members: welcome email, access, first weeks",
   "Supports recruitment: postings and interview scheduling"]),
 (2, None, None, [
   "Coordinates recruitment logistics: postings, applicant tracking and interview scheduling",
   "Runs the onboarding checklist for new members",
   "Keeps HR records and the roster tidy"]),
 (17, MD, "Marketing Director JD", [
   "Sets marketing strategy and the content calendar across Instagram, TikTok, LinkedIn and the newsletter",
   "Leads the marketing team: content developers, designers and web",
   "Brand and campaign owner for fundraising events and awareness campaigns",
   "Reports marketing metrics and insights to the executive team",
   "Executive owner for Marketing and Fundraising Event decisions"]),
 (18, MD, "Marketing Director JD", [
   "Co-directs marketing with Ian: planning, priorities and reviews",
   "Oversees content quality and brand consistency across platforms",
   "Coordinates the weekly content check-ins and deadlines"]),
 (19, D('1m-csjSLFswQg3HLXNT6VijZpDUQpSIucUoS_kFzX3HY'), "Content Coordinator - Job Description", [
   "Maintains the content calendar across Instagram, Facebook, TikTok, LinkedIn and YouTube Shorts",
   "Facilitates weekly content check-ins, assigns tasks and keeps deadlines",
   "Keeps the digital asset library: photos, videos and templates",
   "Manages content rollout for campaigns and event coverage",
   "Tracks engagement metrics and follows up with content developers"]),
 (20, D('1gYcJLVt0aew6-_c9hcloCL5syGFV8FSZy0N4hAV8cvs'), "Brand Designer - Job Description", [
   "Owns the visual identity: logos, colour palette, typography and graphic elements",
   "Maintains the brand guidelines and templates for presentations and social media",
   "Applies the brand across digital and print: social graphics, posters, event signage, merchandise",
   "Reviews visuals from the content team for brand consistency"]),
 (21, CDES, "Content Designer - Job Description", [
   "Designs sponsorship decks and collateral for the fundraising team",
   "Produces print and digital assets on brand",
   "Supports campaigns with visuals and layouts"]),
 (22, CDEV, "Content Developer - Job Description", [
   "Creates posts, stories and reels from the content plan",
   "Leads external collaborations with partner organisations and creators",
   "Monitors comments and messages and flags the important ones"]),
 (23, CDES, "Content Designer - Job Description", [
   "Designs the newsletter and impact graphics",
   "Edits photos and videos for social media and the website",
   "Builds visuals for campaigns and event recaps"]),
 (24, D('1tOLBJTZa4lK56Prc0K-D7R1mkZ6DP57iljYYAkJS8xA'), "Writer Job Description", [
   "Writes articles for the website and copy for campaigns",
   "Drafts LinkedIn posts with the LinkedIn content developer",
   "Researches and develops content ideas on social impact",
   "Keeps copy aligned with the brand voice"]),
 (25, CDEV, "Content Developer - Job Description", [
   "Films and edits short-form video: reels, TikTok and Shorts",
   "Captures photos and video at volunteer and fundraising events",
   "Plans video content with the content developers and the calendar"]),
 (26, D('1BzjjTj7cidXQrYjg70VTawFaMJns9nCpMQNm7l16Fec'), "Technology Coordinator - Job Description", [
   "Develops and maintains the website",
   "Photography at events and for the website",
   "Integrates tools and fixes technical issues for the team"]),
 (1, D('15gcvuFknJ76KHV5OqpBHzZWpTYs9yJU4dxAwek8L_2s'), "Operations Manager - Job Description", [
   "Leads the logistics and operations team so every volunteer event is prepared and runs well",
   "Owns timelines, task ownership and event-critical information: roster, locations, supplies, roles",
   "Sends the weekend itineraries to volunteers and keeps improving the format",
   "Operationalises new programs with Program Development within budget and grant commitments",
   "Scales delivery from about 100 meals biweekly toward weekly and more locations"]),
 (6, D('1I0oCW2xyiE0zJvEo0QvGjvroBV0Jpi_0Y1Y8exIVKro'), "Kitchen Coordinator (Volunteer)", [
   "Coordinates cooks and volunteers for meal preparation",
   "Keeps food handling, storage and cleaning to food safety standards",
   "Plans kitchen activities and meal preparation schedules",
   "Reports safety or operational concerns to the operations lead"]),
 (43, OA, "Operation Assistant Job Description", [
   "Supports event set-up, transport and supplies on event days",
   "Confirms volunteers and answers day-to-day questions",
   "Helps keep the storage unit and equipment in order"]),
 (45, OA, "Operation Assistant Job Description", [
   "Supports event set-up, transport and supplies on event days",
   "Confirms volunteers and answers day-to-day questions",
   "Helps keep the storage unit and equipment in order"]),
 (9, D('1Rqpqn1eLs3LNx74ZOmf7BsU5AndyTcwqKf79W0zCv8s'), "Director of Operations - Job Description", [
   "Leads Welfare Avenue's Toronto operations and team",
   "Oversees program delivery, logistics and volunteer management in Ontario",
   "Sets KPIs and runs the weekly operations meetings for the Toronto team",
   "Builds partnerships (food bank project, Daily Bread, Second Harvest) and city expansion",
   "Reports to the Co-Executive Director in Toronto"]),
 (8, TOA, "Toronto Operation Assistant Job Description", [
   "Supports Toronto meal events: set-up, supplies and volunteer coordination",
   "Confirms volunteers and tracks attendance",
   "Helps track event metrics: attendance, location, meals served"]),
 (16, F('1sTpUZ8-yGnioZR4xWNyJgwBt3BcsfEog'), "Welfare Avenue - Driver Job Description", [
   "Drives food, supplies and equipment to and from events",
   "Coordinates pick-up times with the operations team",
   "Keeps the vehicle and loads safe and on schedule"]),
 (10, None, None, [
   "Develops Toronto programs on the City Director path",
   "Supports grants and program funding for Ontario",
   "Works with Tate and Mandeep on KPIs and partners"]),
 (11, D('1vA-AB4aC6cJsJnxVUZMNq2-uR0nwBwnXW8Pi0FP6ll0'), "Partnership Coordinator", [
   "Identifies and initiates partnerships with businesses, corporations and organisations",
   "Maintains relationships with existing partners",
   "Coordinates joint projects with internal teams",
   "Represents Welfare Avenue at networking events"]),
 (15, D('1v1WeLRhcWL8DpxSic2vOnFXyNo4uC38_lB-obRHyq3w'), "Club Development Coordinator", [
   "Builds student club and chapter relationships at Toronto institutions",
   "Runs the Community Closet initiative",
   "Supports club leaders with resources and mentorship"]),
 (14, TOA, "Toronto Operation Assistant Job Description", [
   "Supports Toronto meal events and outreach on event days",
   "Confirms volunteers and helps with set-up and clean-up"]),
 (13, TOA, "Toronto Operation Assistant Job Description", [
   "Supports Toronto meal events and outreach on event days",
   "Confirms volunteers and helps with set-up and clean-up"]),
 (12, TOA, "Toronto Operation Assistant Job Description", [
   "Supports Toronto meal events and outreach on event days",
   "Confirms volunteers and helps with set-up and clean-up"]),
 (3, PDC, "Program & Development Coordinator - Job Description", [
   "Leads program development: programs that help the people we serve take steps out of poverty",
   "Owns research and data: needs assessments, surveys and impact measurement",
   "Builds partnerships with grassroots organisations for goods and resources",
   "Plans strategic initiatives (the 600k plan) and reports outcomes to the executive team",
   "Executive owner for Montreal Operations and Program Development decisions"]),
 (4, PDC, "Program & Development Coordinator - Job Description", [
   "Coordinates beneficiaries: intake, communication and feedback",
   "Runs the Beneficiary Feedback project",
   "Supports program design and partner collaboration"]),
 (7, D('1BD7aVC1FEsp3mb4mQw2Cc27w1LQB1QYS1GN7AUc6RA8'), "Research & Data Analyst (Volunteer) - Job Description", [
   "Runs the survey and data collection tools",
   "Analyses program data and drafts impact reports",
   "Researches target populations and community needs"]),
 (46, F('1ywdeSh8gteNc0Q39lUeB3_POPI094kN7'), "Community Team Lead job description (first draft)", [
   "Leads the community team on the ground",
   "Coordinates community outreach and program delivery with Program Development",
   "Gathers community feedback for program improvement"]),
]
def q(s): return "'" + s.replace("'", "''") + "'"
vals = []
for mid, url, name, resp in ROWS:
    vals.append("(%d, %s, %s, %s::jsonb)" % (mid, q(url) if url else 'null', q(name) if name else 'null', q(json.dumps(resp))))
sql = """update public.team_members m set jd_url = v.jd_url, jd_name = v.jd_name, responsibilities = v.resp
from (values
%s
) as v(id, jd_url, jd_name, resp)
where m.id = v.id and (m.jd_url is null) and (m.responsibilities is null or jsonb_typeof(m.responsibilities) <> 'array' or jsonb_array_length(m.responsibilities) = 0);
insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by)
select 'team_member', v.id::text, 'job_description', 'none', coalesce(v.jd_name, 'responsibilities only'), 'hub (wave116k, from the HR shared drive job descriptions)'
from (values
%s
) as v(id, jd_url, jd_name, resp);""" % (",\n".join(vals), ",\n".join(vals))
open('/root/wa-hub/build/data/w116k_jd_map.sql', 'w').write(sql)
print(len(ROWS), 'rows;', len(sql), 'chars')
