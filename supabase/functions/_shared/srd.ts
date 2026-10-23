// The one SRD index every persona shares. Built once per cold start.
import data from "./srd/srd-5.2.1.json" with { type: "json" };
import { SrdIndex, type SrdData } from "./retrieval.ts";

export const srd = new SrdIndex(data as SrdData);
