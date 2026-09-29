-- wa164b_finance_comments (29/09/26): the schema says where Finance's rows are (wave164, Finance on its own, apart from Fundraising).
comment on column public.dept_tasks.department is 'Team code that owns the task (opsmtl, opsto, progdev, marketing, fundraising, hr, board), or finance: Finance''s own board in the Finance app (wave164; Finance has no team page). No foreign key.';
comment on column public.dept_requests.department is 'Team code the request is addressed to, or finance (wave164: reimbursements and purchase orders; Finance''s team inbox is on the Finance app''s Overview).';
comment on column public.hub_mail.department is 'Team code the email was filed to, if any. Every money email (kind invoice: invoices, receipts, payment notices, reimbursements) is finance since wave164, posted in #accounting-finance.';
comment on column public.request_types.department is 'Team code that receives this type; reimbursement and purchase-order go to finance (wave164).';
