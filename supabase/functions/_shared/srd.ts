// The one SRD index every persona shares. Built once per cold start.
import data from "./srd/srd-5.2.1.json" with { type: "json" };
import english from "./words/english-common.json" with { type: "json" };
import { SrdIndex, type SrdData } from "./retrieval.ts";

// Common English words (SCOWL size 35, see words/SCOWL-COPYRIGHT.txt) are never treated as typos.
export const srd = new SrdIndex(data as SrdData, english.words.split(" "));
