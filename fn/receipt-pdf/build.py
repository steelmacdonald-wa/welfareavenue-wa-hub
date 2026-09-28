#!/usr/bin/env python3
"""Join the receipt drawing (render.js, shared with the local check) and the server (serve.ts) into index.ts:
python3 fn/receipt-pdf/build.py"""
import os
D = os.path.dirname(os.path.abspath(__file__))
head = """// Welfare Avenue: receipt-pdf (v1, 28/09/26 Toronto, wave158b)
// Draws CRA donation receipts as PDFs (pdf-lib). Built from render.js (the drawing, also run by the local check) and serve.ts
// by build.py: edit those two, then rebuild this file.
// Actions (a staff JWT; the database checks the caller, the functions below run as them):
//   sample {gift_id}     -> a sample for one gift from crm_receipt_sample: marked SAMPLE, never numbered, kept or sent (pdf_b64)
//   check                -> the build's check that the drawing works (x-wa-secret; a made-up receipt, nothing read or kept)
//   render {receipt_id}  -> the official copy of an issued receipt (admins; crm_receipt_doc), drawn once into the private bucket
//                           receipts (<tax year>/<serial>.pdf) with its checksum (crm_receipt_pdf_set); a cancelled receipt gets
//                           its copy marked CANCELLED beside it (<serial>-cancelled.pdf). Returns the path.
// The signature is the image an admin uploaded to receipts/settings/signature.png; the logo is the Hub's brand logo. A name the
// PDF font cannot print stops an official copy (issue that one by hand); a sample shows ? instead.
// @ts-nocheck
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as PDFLib from 'npm:pdf-lib@1.17.1';

"""
render = open(os.path.join(D, 'render.js'), encoding='utf8').read()
serve = open(os.path.join(D, 'serve.ts'), encoding='utf8').read()
open(os.path.join(D, 'index.ts'), 'w', encoding='utf8').write(head + render + serve)
print('index.ts', len(head + render + serve), 'chars')
