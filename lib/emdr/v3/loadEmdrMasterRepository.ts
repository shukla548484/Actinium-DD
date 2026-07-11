import fs from "node:fs";
import {
  EMDR_V30_MASTER_REPOSITORY_PATH,
  EMDR_V31_MASTER_REPOSITORY_PATH,
  EMDR_V32_MASTER_REPOSITORY_PATH,
  EMDR_V33_MASTER_REPOSITORY_PATH,
  EMDR_V34_MASTER_REPOSITORY_PATH,
  EMDR_V36_MASTER_REPOSITORY_PATH,
  EMDR_V37_MASTER_REPOSITORY_PATH,
  EMDR_V38_MASTER_REPOSITORY_PATH,
  EMDR_V39_MASTER_REPOSITORY_PATH,
  EMDR_V39_CAS_MASTER_REPOSITORY_PATH,
  EMDR_V310_MASTER_REPOSITORY_PATH,
  EMDR_V310_STG_MASTER_REPOSITORY_PATH,
  EMDR_V311_MASTER_REPOSITORY_PATH,
  EMDR_V311_DMK_MASTER_REPOSITORY_PATH,
  EMDR_V314_EMO_MASTER_REPOSITORY_PATH,
  EMDR_V315_PCS_MASTER_REPOSITORY_PATH,
  EMDR_V316_PUMP_MASTER_REPOSITORY_PATH,
  EMDR_V317_HEX_MASTER_REPOSITORY_PATH,
  EMDR_V320_IGS_MASTER_REPOSITORY_PATH,
  EMDR_V321_ENV_MASTER_REPOSITORY_PATH,
  EMDR_V322_EPD_MASTER_REPOSITORY_PATH,
  EMDR_V323_FLS_MASTER_REPOSITORY_PATH,
  EMDR_V324_PROP_MASTER_REPOSITORY_PATH,
  EMDR_V325_HVAC_MASTER_REPOSITORY_PATH,
  EMDR_V326_AUTO_MASTER_REPOSITORY_PATH,
  EMDR_V327_VPSO_MASTER_REPOSITORY_PATH,
  EMDR_V328_NAVCOM_MASTER_REPOSITORY_PATH,
  EMDR_V329_TGLI_MASTER_REPOSITORY_PATH,
  EMDR_V330_HYPN_MASTER_REPOSITORY_PATH,
  EMDR_V331_AGLH_MASTER_REPOSITORY_PATH,
  EMDR_V332_WMTP_MASTER_REPOSITORY_PATH,
  EMDR_V333_DFMT_MASTER_REPOSITORY_PATH,
  EMDR_V334_HULL_MASTER_REPOSITORY_PATH,
  EMDR_V335_CHHC_MASTER_REPOSITORY_PATH,
  EMDR_V336_DWSS_MASTER_REPOSITORY_PATH,
  EMDR_V337_SCACS_MASTER_REPOSITORY_PATH,
  EMDR_V339_SVSS_MASTER_REPOSITORY_PATH,
  EMDR_V340_CSST_MASTER_REPOSITORY_PATH,
  EMDR_V341_EDMC_MASTER_REPOSITORY_PATH,
  EMDR_V312_MASTER_REPOSITORY_PATH,
  isEmdrV33MasterRepositoryPresent,
  type EmdrMasterRepositoryKind,
} from "@/lib/emdr/paths";
import { mergeParsedEmdrRepositories } from "@/lib/emdr/v3/mergeMasterRepositories";
import { parseV38IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV38IncrementalRepository";
import { parseV312IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV312IncrementalRepository";
import { parseV311DeckMachineryRepositoryIfExists } from "@/lib/emdr/v3/parseV311DeckMachineryRepository";
import { parseV315PurifiersRepositoryIfExists } from "@/lib/emdr/v3/parseV315PurifiersRepository";
import { parseV316ShipboardPumpsRepositoryIfExists } from "@/lib/emdr/v3/parseV316ShipboardPumpsRepository";
import { parseV317HeatExchangersRepositoryIfExists } from "@/lib/emdr/v3/parseV317HeatExchangersRepository";
import { parseV320InertGasRepositoryIfExists } from "@/lib/emdr/v3/parseV320InertGasRepository";
import { parseV321EnvironmentalMachineryRepositoryIfExists } from "@/lib/emdr/v3/parseV321EnvironmentalMachineryRepository";
import { parseV322ElectricalPowerRepositoryIfExists } from "@/lib/emdr/v3/parseV322ElectricalPowerRepository";
import { parseV323FireLsaSafetyRepositoryIfExists, isV323TypewiseFfsJobId } from "@/lib/emdr/v3/parseV323FireLsaSafetyRepository";
import { parseV324PropulsionShaftingRepositoryIfExists } from "@/lib/emdr/v3/parseV324PropulsionShaftingRepository";
import { parseV325HvacVentilationRepositoryIfExists, isV325TypewiseHvacJobId } from "@/lib/emdr/v3/parseV325HvacVentilationRepository";
import { parseV326AutomationIasRepositoryIfExists } from "@/lib/emdr/v3/parseV326AutomationIasRepository";
import { parseV327ValvesPipingRepositoryIfExists } from "@/lib/emdr/v3/parseV327ValvesPipingRepository";
import { parseV328NavigationCommunicationRepositoryIfExists } from "@/lib/emdr/v3/parseV328NavigationCommunicationRepository";
import { parseV329TankGaugingRepositoryIfExists } from "@/lib/emdr/v3/parseV329TankGaugingRepository";
import { parseV330HydraulicPneumaticRepositoryIfExists } from "@/lib/emdr/v3/parseV330HydraulicPneumaticRepository";
import { parseV331AccommodationRepositoryIfExists } from "@/lib/emdr/v3/parseV331AccommodationRepository";
import { parseV332WorkshopMachineryRepositoryIfExists } from "@/lib/emdr/v3/parseV332WorkshopMachineryRepository";
import { parseV333DeckFittingsRepositoryIfExists } from "@/lib/emdr/v3/parseV333DeckFittingsRepository";
import { parseV334HullStructureRepositoryIfExists } from "@/lib/emdr/v3/parseV334HullStructureRepository";
import { parseV335CargoHoldRepositoryIfExists } from "@/lib/emdr/v3/parseV335CargoHoldRepository";
import { parseV336DomesticWaterRepositoryIfExists } from "@/lib/emdr/v3/parseV336DomesticWaterRepository";
import { parseV337SecurityCctvRepositoryIfExists } from "@/lib/emdr/v3/parseV337SecurityCctvRepository";
import { parseV339SpecialVesselRepositoryIfExists } from "@/lib/emdr/v3/parseV339SpecialVesselRepository";
import { parseV340ClassStatutoryRepositoryIfExists } from "@/lib/emdr/v3/parseV340ClassStatutoryRepository";
import { parseV341GapClosureRepositoryIfExists } from "@/lib/emdr/v3/parseV341GapClosureRepository";
import { parseV314ElectricalMotorsRepositoryIfExists } from "@/lib/emdr/v3/parseV314ElectricalMotorsRepository";
import { parseV311IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV311IncrementalRepository";
import { parseV310SteeringGearRepositoryIfExists } from "@/lib/emdr/v3/parseV310SteeringGearRepository";
import { parseV310IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV310IncrementalRepository";
import {
  parseV3MasterRepositoryFileIfExists,
  type ParsedV3MasterRepository,
} from "@/lib/emdr/v3/parseMasterRepository";
import { parseV39CompressedAirRepositoryIfExists } from "@/lib/emdr/v3/parseV39CompressedAirRepository";
import { parseV39IncrementalRepositoryIfExists } from "@/lib/emdr/v3/parseV39IncrementalRepository";
import { EMDR_V312_RELEASE, EMDR_V311_RELEASE, EMDR_V310_RELEASE, EMDR_V38_RELEASE, EMDR_V39_RELEASE } from "@/lib/emdr/v3/sheets";

/** Full cumulative workbooks only — V3.8+ are incremental supplements. */
const CUMULATIVE_STANDALONE_REPOSITORIES: { kind: EmdrMasterRepositoryKind; path: string }[] = [
  { kind: "v37", path: EMDR_V37_MASTER_REPOSITORY_PATH },
  { kind: "v36", path: EMDR_V36_MASTER_REPOSITORY_PATH },
  { kind: "v34", path: EMDR_V34_MASTER_REPOSITORY_PATH },
];

let cachedLoadedKind: EmdrMasterRepositoryKind | null | undefined;

function loadV38SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV38IncrementalRepositoryIfExists(EMDR_V38_MASTER_REPOSITORY_PATH);
}

function loadV39CasSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV39CompressedAirRepositoryIfExists(EMDR_V39_CAS_MASTER_REPOSITORY_PATH);
}

function loadV39SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV39IncrementalRepositoryIfExists(EMDR_V39_MASTER_REPOSITORY_PATH);
}

function loadV312SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV312IncrementalRepositoryIfExists(EMDR_V312_MASTER_REPOSITORY_PATH);
}

function loadV311SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV311IncrementalRepositoryIfExists(EMDR_V311_MASTER_REPOSITORY_PATH);
}

function loadV311DmkSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV311DeckMachineryRepositoryIfExists(EMDR_V311_DMK_MASTER_REPOSITORY_PATH);
}

function loadV316PumpSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV316ShipboardPumpsRepositoryIfExists(EMDR_V316_PUMP_MASTER_REPOSITORY_PATH);
}

function loadV317HexSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV317HeatExchangersRepositoryIfExists(EMDR_V317_HEX_MASTER_REPOSITORY_PATH);
}

function loadV320IgsSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV320InertGasRepositoryIfExists(EMDR_V320_IGS_MASTER_REPOSITORY_PATH);
}

function loadV321EnvSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV321EnvironmentalMachineryRepositoryIfExists(EMDR_V321_ENV_MASTER_REPOSITORY_PATH);
}

function loadV322EpdSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV322ElectricalPowerRepositoryIfExists(EMDR_V322_EPD_MASTER_REPOSITORY_PATH);
}

function loadV323FlsSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV323FireLsaSafetyRepositoryIfExists(EMDR_V323_FLS_MASTER_REPOSITORY_PATH);
}

function loadV324PropSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV324PropulsionShaftingRepositoryIfExists(EMDR_V324_PROP_MASTER_REPOSITORY_PATH);
}

function loadV325HvacSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV325HvacVentilationRepositoryIfExists(EMDR_V325_HVAC_MASTER_REPOSITORY_PATH);
}

function loadV326AutoSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV326AutomationIasRepositoryIfExists(EMDR_V326_AUTO_MASTER_REPOSITORY_PATH);
}

function loadV327VpsoSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV327ValvesPipingRepositoryIfExists(EMDR_V327_VPSO_MASTER_REPOSITORY_PATH);
}

function loadV328NavcomSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV328NavigationCommunicationRepositoryIfExists(EMDR_V328_NAVCOM_MASTER_REPOSITORY_PATH);
}

function loadV329TgliSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV329TankGaugingRepositoryIfExists(EMDR_V329_TGLI_MASTER_REPOSITORY_PATH);
}

function loadV330HypnSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV330HydraulicPneumaticRepositoryIfExists(EMDR_V330_HYPN_MASTER_REPOSITORY_PATH);
}

function loadV331AglhSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV331AccommodationRepositoryIfExists(EMDR_V331_AGLH_MASTER_REPOSITORY_PATH);
}

function loadV332WmtpSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV332WorkshopMachineryRepositoryIfExists(EMDR_V332_WMTP_MASTER_REPOSITORY_PATH);
}

function loadV333DfmtSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV333DeckFittingsRepositoryIfExists(EMDR_V333_DFMT_MASTER_REPOSITORY_PATH);
}

function loadV334HullSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV334HullStructureRepositoryIfExists(EMDR_V334_HULL_MASTER_REPOSITORY_PATH);
}

function loadV335ChhcSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV335CargoHoldRepositoryIfExists(EMDR_V335_CHHC_MASTER_REPOSITORY_PATH);
}

function loadV336DwssSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV336DomesticWaterRepositoryIfExists(EMDR_V336_DWSS_MASTER_REPOSITORY_PATH);
}

function loadV337ScacsSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV337SecurityCctvRepositoryIfExists(EMDR_V337_SCACS_MASTER_REPOSITORY_PATH);
}

function loadV339SvssSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV339SpecialVesselRepositoryIfExists(EMDR_V339_SVSS_MASTER_REPOSITORY_PATH);
}

function loadV340CsstSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV340ClassStatutoryRepositoryIfExists(EMDR_V340_CSST_MASTER_REPOSITORY_PATH);
}

function loadV341EdmcSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV341GapClosureRepositoryIfExists(EMDR_V341_EDMC_MASTER_REPOSITORY_PATH);
}

function loadV315PcsSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV315PurifiersRepositoryIfExists(EMDR_V315_PCS_MASTER_REPOSITORY_PATH);
}

function loadV314EmoSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV314ElectricalMotorsRepositoryIfExists(EMDR_V314_EMO_MASTER_REPOSITORY_PATH);
}

function loadV310StgSupplementParsed(): ParsedV3MasterRepository | null {
  return parseV310SteeringGearRepositoryIfExists(EMDR_V310_STG_MASTER_REPOSITORY_PATH);
}

function loadV310SupplementParsed(): ParsedV3MasterRepository | null {
  return parseV310IncrementalRepositoryIfExists(EMDR_V310_MASTER_REPOSITORY_PATH);
}

function loadCumulativeStandaloneParsed(): ParsedV3MasterRepository | null {
  for (const entry of CUMULATIVE_STANDALONE_REPOSITORIES) {
    const parsed = parseV3MasterRepositoryFileIfExists(entry.path);
    if (parsed) return parsed;
  }

  const v33 = parseV3MasterRepositoryFileIfExists(EMDR_V33_MASTER_REPOSITORY_PATH);
  const v32 = isEmdrV33MasterRepositoryPresent()
    ? null
    : parseV3MasterRepositoryFileIfExists(EMDR_V32_MASTER_REPOSITORY_PATH);
  const v31 = parseV3MasterRepositoryFileIfExists(EMDR_V31_MASTER_REPOSITORY_PATH);
  const v30 = parseV3MasterRepositoryFileIfExists(EMDR_V30_MASTER_REPOSITORY_PATH);

  const base = v31 ?? v30;
  const supplement = v33 ?? v32;

  if (base && supplement) return mergeParsedEmdrRepositories(base, supplement);
  if (v33) return v33;
  if (v32) return v32;
  if (v31) return v31;
  if (v30) return v30;
  return null;
}

function isV38Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  if (isV325TypewiseHvacJobId(job.jobId)) return false;
  return (
    job.jobId.startsWith("JOBS-V38-") ||
    /fresh water generator|\bfwg\b|air conditioning|refrigeration|\bhvac\b/i.test(job.machinery)
  );
}

function isV39Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  return job.jobId.startsWith("JOBS-DMW-") || /windlass|winch|capstan|deck machinery/i.test(job.machinery);
}

function isV312Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  return (
    job.jobId.startsWith("JOBS-IGG-") ||
    job.jobId.startsWith("JOBS-IGS-") ||
    /inert gas|\bigg\b|scrubber|nitrogen generator/i.test(job.machinery)
  );
}

function isV311Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  if (isV323TypewiseFfsJobId(job.jobId)) return false;
  return (
    job.jobId.includes("-FFS-") ||
    /fire fighting systems/i.test(job.machinery)
  );
}

function isV310Job(job: ParsedV3MasterRepository["masterJobs"][number]): boolean {
  if (isV323TypewiseFfsJobId(job.jobId)) return false;
  return (
    job.jobId.startsWith("JOBS-LSA-") ||
    /life saving appliances|davit|rescue boat davit/i.test(job.machinery)
  );
}

function finalizeMergedRepository(
  merged: ParsedV3MasterRepository,
  release: string,
): ParsedV3MasterRepository {
  return {
    ...merged,
    libraryVersion: release,
    release,
    masterJobs: merged.masterJobs.map((job) => ({
      ...job,
      libraryVersion: isV312Job(job)
        ? EMDR_V312_RELEASE
        : isV311Job(job)
          ? EMDR_V311_RELEASE
          : isV310Job(job)
          ? EMDR_V310_RELEASE
          : isV39Job(job)
          ? EMDR_V39_RELEASE
          : isV38Job(job)
            ? EMDR_V38_RELEASE
            : job.libraryVersion,
    })),
  };
}

function loadMergedMasterRepository(): ParsedV3MasterRepository | null {
  let merged = loadCumulativeStandaloneParsed();
  const v38 = loadV38SupplementParsed();
  const v39 = loadV39SupplementParsed();
  const v310 = loadV310SupplementParsed();
  const v311 = loadV311SupplementParsed();
  const v312 = loadV312SupplementParsed();
  const v39Cas = loadV39CasSupplementParsed();
  const v310Stg = loadV310StgSupplementParsed();
  const v311Dmk = loadV311DmkSupplementParsed();
  const v314Emo = loadV314EmoSupplementParsed();
  const v315Pcs = loadV315PcsSupplementParsed();
  const v316Pump = loadV316PumpSupplementParsed();
  const v317Hex = loadV317HexSupplementParsed();
  const v320Igs = loadV320IgsSupplementParsed();
  const v321Env = loadV321EnvSupplementParsed();
  const v322Epd = loadV322EpdSupplementParsed();
  const v323Fls = loadV323FlsSupplementParsed();
  const v324Prop = loadV324PropSupplementParsed();
  const v325Hvac = loadV325HvacSupplementParsed();
  const v326Auto = loadV326AutoSupplementParsed();
  const v327Vpso = loadV327VpsoSupplementParsed();
  const v328Navcom = loadV328NavcomSupplementParsed();
  const v329Tgli = loadV329TgliSupplementParsed();
  const v330Hypn = loadV330HypnSupplementParsed();
  const v331Aglh = loadV331AglhSupplementParsed();
  const v332Wmtp = loadV332WmtpSupplementParsed();
  const v333Dfmt = loadV333DfmtSupplementParsed();
  const v334Hull = loadV334HullSupplementParsed();
  const v335Chhc = loadV335ChhcSupplementParsed();
  const v336Dwss = loadV336DwssSupplementParsed();
  const v337Scacs = loadV337ScacsSupplementParsed();
  const v339Svss = loadV339SvssSupplementParsed();
  const v340Csst = loadV340CsstSupplementParsed();
  const v341Edmc = loadV341EdmcSupplementParsed();

  if (v38 && merged) merged = mergeParsedEmdrRepositories(merged, v38);
  else if (v38) merged = v38;

  if (v39 && merged) merged = mergeParsedEmdrRepositories(merged, v39);
  else if (v39) merged = v39;

  if (v310 && merged) merged = mergeParsedEmdrRepositories(merged, v310);
  else if (v310) merged = v310;

  if (v311 && merged) merged = mergeParsedEmdrRepositories(merged, v311);
  else if (v311) merged = v311;

  if (v312 && merged) merged = mergeParsedEmdrRepositories(merged, v312);
  else if (v312) merged = v312;

  if (v39Cas && merged) merged = mergeParsedEmdrRepositories(merged, v39Cas);
  else if (v39Cas) merged = v39Cas;

  if (v310Stg && merged) merged = mergeParsedEmdrRepositories(merged, v310Stg);
  else if (v310Stg) merged = v310Stg;

  if (v311Dmk && merged) merged = mergeParsedEmdrRepositories(merged, v311Dmk);
  else if (v311Dmk) merged = v311Dmk;

  if (v314Emo && merged) merged = mergeParsedEmdrRepositories(merged, v314Emo);
  else if (v314Emo) merged = v314Emo;

  if (v315Pcs && merged) merged = mergeParsedEmdrRepositories(merged, v315Pcs);
  else if (v315Pcs) merged = v315Pcs;

  if (v316Pump && merged) merged = mergeParsedEmdrRepositories(merged, v316Pump);
  else if (v316Pump) merged = v316Pump;

  if (v317Hex && merged) merged = mergeParsedEmdrRepositories(merged, v317Hex);
  else if (v317Hex) merged = v317Hex;

  if (v320Igs && merged) merged = mergeParsedEmdrRepositories(merged, v320Igs);
  else if (v320Igs) merged = v320Igs;

  if (v321Env && merged) merged = mergeParsedEmdrRepositories(merged, v321Env);
  else if (v321Env) merged = v321Env;

  if (v322Epd && merged) merged = mergeParsedEmdrRepositories(merged, v322Epd);
  else if (v322Epd) merged = v322Epd;

  if (v323Fls && merged) merged = mergeParsedEmdrRepositories(merged, v323Fls);
  else if (v323Fls) merged = v323Fls;

  if (v324Prop && merged) merged = mergeParsedEmdrRepositories(merged, v324Prop);
  else if (v324Prop) merged = v324Prop;

  if (v325Hvac && merged) merged = mergeParsedEmdrRepositories(merged, v325Hvac);
  else if (v325Hvac) merged = v325Hvac;

  if (v326Auto && merged) merged = mergeParsedEmdrRepositories(merged, v326Auto);
  else if (v326Auto) merged = v326Auto;

  if (v327Vpso && merged) merged = mergeParsedEmdrRepositories(merged, v327Vpso);
  else if (v327Vpso) merged = v327Vpso;

  if (v328Navcom && merged) merged = mergeParsedEmdrRepositories(merged, v328Navcom);
  else if (v328Navcom) merged = v328Navcom;

  if (v329Tgli && merged) merged = mergeParsedEmdrRepositories(merged, v329Tgli);
  else if (v329Tgli) merged = v329Tgli;

  if (v330Hypn && merged) merged = mergeParsedEmdrRepositories(merged, v330Hypn);
  else if (v330Hypn) merged = v330Hypn;

  if (v331Aglh && merged) merged = mergeParsedEmdrRepositories(merged, v331Aglh);
  else if (v331Aglh) merged = v331Aglh;

  if (v332Wmtp && merged) merged = mergeParsedEmdrRepositories(merged, v332Wmtp);
  else if (v332Wmtp) merged = v332Wmtp;

  if (v333Dfmt && merged) merged = mergeParsedEmdrRepositories(merged, v333Dfmt);
  else if (v333Dfmt) merged = v333Dfmt;

  if (v334Hull && merged) merged = mergeParsedEmdrRepositories(merged, v334Hull);
  else if (v334Hull) merged = v334Hull;

  if (v335Chhc && merged) merged = mergeParsedEmdrRepositories(merged, v335Chhc);
  else if (v335Chhc) merged = v335Chhc;

  if (v336Dwss && merged) merged = mergeParsedEmdrRepositories(merged, v336Dwss);
  else if (v336Dwss) merged = v336Dwss;

  if (v337Scacs && merged) merged = mergeParsedEmdrRepositories(merged, v337Scacs);
  else if (v337Scacs) merged = v337Scacs;

  if (v339Svss && merged) merged = mergeParsedEmdrRepositories(merged, v339Svss);
  else if (v339Svss) merged = v339Svss;

  if (v340Csst && merged) merged = mergeParsedEmdrRepositories(merged, v340Csst);
  else if (v340Csst) merged = v340Csst;

  if (v341Edmc && merged) merged = mergeParsedEmdrRepositories(merged, v341Edmc);
  else if (v341Edmc) merged = v341Edmc;

  if (!merged) return null;

  if (v312 || v39Cas || v310Stg || v311Dmk || v314Emo || v315Pcs || v316Pump || v317Hex || v320Igs || v321Env || v322Epd || v323Fls || v324Prop || v325Hvac || v326Auto || v327Vpso || v328Navcom || v329Tgli || v330Hypn || v331Aglh || v332Wmtp || v333Dfmt || v334Hull || v335Chhc || v336Dwss || v337Scacs || v339Svss || v340Csst || v341Edmc) return finalizeMergedRepository(merged, EMDR_V312_RELEASE);
  if (v311) return finalizeMergedRepository(merged, EMDR_V311_RELEASE);
  if (v310) return finalizeMergedRepository(merged, EMDR_V310_RELEASE);
  if (v39) return finalizeMergedRepository(merged, EMDR_V39_RELEASE);
  if (v38) return finalizeMergedRepository(merged, EMDR_V38_RELEASE);
  return merged;
}

/** Highest V3.x repository that parses successfully (skips corrupt files on disk). */
export function resolveLoadedEmdrMasterRepositoryKind(): EmdrMasterRepositoryKind | null {
  if (cachedLoadedKind !== undefined) return cachedLoadedKind;

  if (loadV312SupplementParsed() || loadV39CasSupplementParsed() || loadV310StgSupplementParsed() || loadV311DmkSupplementParsed() || loadV314EmoSupplementParsed() || loadV315PcsSupplementParsed() || loadV316PumpSupplementParsed() || loadV317HexSupplementParsed() || loadV320IgsSupplementParsed() || loadV321EnvSupplementParsed() || loadV322EpdSupplementParsed() || loadV323FlsSupplementParsed() || loadV324PropSupplementParsed() || loadV325HvacSupplementParsed() || loadV326AutoSupplementParsed() || loadV327VpsoSupplementParsed() || loadV328NavcomSupplementParsed() || loadV329TgliSupplementParsed() || loadV330HypnSupplementParsed() || loadV331AglhSupplementParsed() || loadV332WmtpSupplementParsed() || loadV333DfmtSupplementParsed() || loadV334HullSupplementParsed() || loadV335ChhcSupplementParsed() || loadV336DwssSupplementParsed() || loadV337ScacsSupplementParsed() || loadV339SvssSupplementParsed() || loadV340CsstSupplementParsed() || loadV341EdmcSupplementParsed()) {
    cachedLoadedKind = "v312";
    return cachedLoadedKind;
  }
  if (loadV311SupplementParsed()) {
    cachedLoadedKind = "v311";
    return cachedLoadedKind;
  }
  if (loadV310SupplementParsed()) {
    cachedLoadedKind = "v310";
    return cachedLoadedKind;
  }
  if (loadV39SupplementParsed()) {
    cachedLoadedKind = "v39";
    return cachedLoadedKind;
  }
  if (loadV38SupplementParsed()) {
    cachedLoadedKind = "v38";
    return cachedLoadedKind;
  }

  for (const entry of CUMULATIVE_STANDALONE_REPOSITORIES) {
    if (!fs.existsSync(entry.path)) continue;
    if (parseV3MasterRepositoryFileIfExists(entry.path)) {
      cachedLoadedKind = entry.kind;
      return cachedLoadedKind;
    }
  }

  const v33 = parseV3MasterRepositoryFileIfExists(EMDR_V33_MASTER_REPOSITORY_PATH);
  const v32 = isEmdrV33MasterRepositoryPresent()
    ? null
    : parseV3MasterRepositoryFileIfExists(EMDR_V32_MASTER_REPOSITORY_PATH);
  const v31 = parseV3MasterRepositoryFileIfExists(EMDR_V31_MASTER_REPOSITORY_PATH);
  const v30 = parseV3MasterRepositoryFileIfExists(EMDR_V30_MASTER_REPOSITORY_PATH);
  const base = v31 ?? v30;
  const supplement = v33 ?? v32;

  if (base && supplement) {
    cachedLoadedKind = v33 ? "v33" : "v32";
    return cachedLoadedKind;
  }
  if (v33) {
    cachedLoadedKind = "v33";
    return cachedLoadedKind;
  }
  if (v32) {
    cachedLoadedKind = "v32";
    return cachedLoadedKind;
  }
  if (v31) {
    cachedLoadedKind = "v31";
    return cachedLoadedKind;
  }
  if (v30) {
    cachedLoadedKind = "v30";
    return cachedLoadedKind;
  }

  cachedLoadedKind = null;
  return null;
}

/** @deprecated Prefer resolveLoadedEmdrMasterRepositoryKind for runtime behavior. */
export { resolveEmdrMasterRepositoryKind } from "@/lib/emdr/paths";

/** Load cumulative base plus optional V3.8–V3.12 incremental supplements. */
export function loadEmdrMasterRepositoryParsed(): ParsedV3MasterRepository | null {
  return loadMergedMasterRepository();
}

export function loadEmdrMasterRepositoryParsedFromPath(path: string): ParsedV3MasterRepository {
  const v341Edmc = parseV341GapClosureRepositoryIfExists(path);
  if (v341Edmc) return v341Edmc;
  const v340Csst = parseV340ClassStatutoryRepositoryIfExists(path);
  if (v340Csst) return v340Csst;
  const v339Svss = parseV339SpecialVesselRepositoryIfExists(path);
  if (v339Svss) return v339Svss;
  const v336Dwss = parseV336DomesticWaterRepositoryIfExists(path);
  if (v336Dwss) return v336Dwss;
  const v337Scacs = parseV337SecurityCctvRepositoryIfExists(path);
  if (v337Scacs) return v337Scacs;
  const v335Chhc = parseV335CargoHoldRepositoryIfExists(path);
  if (v335Chhc) return v335Chhc;
  const v334Hull = parseV334HullStructureRepositoryIfExists(path);
  if (v334Hull) return v334Hull;
  const v333Dfmt = parseV333DeckFittingsRepositoryIfExists(path);
  if (v333Dfmt) return v333Dfmt;
  const v332Wmtp = parseV332WorkshopMachineryRepositoryIfExists(path);
  if (v332Wmtp) return v332Wmtp;
  const v331Aglh = parseV331AccommodationRepositoryIfExists(path);
  if (v331Aglh) return v331Aglh;
  const v329Tgli = parseV329TankGaugingRepositoryIfExists(path);
  if (v329Tgli) return v329Tgli;
  const v330Hypn = parseV330HydraulicPneumaticRepositoryIfExists(path);
  if (v330Hypn) return v330Hypn;
  const v328Navcom = parseV328NavigationCommunicationRepositoryIfExists(path);
  if (v328Navcom) return v328Navcom;
  const v326Auto = parseV326AutomationIasRepositoryIfExists(path);
  if (v326Auto) return v326Auto;
  const v327Vpso = parseV327ValvesPipingRepositoryIfExists(path);
  if (v327Vpso) return v327Vpso;
  const v325Hvac = parseV325HvacVentilationRepositoryIfExists(path);
  if (v325Hvac) return v325Hvac;
  const v324Prop = parseV324PropulsionShaftingRepositoryIfExists(path);
  if (v324Prop) return v324Prop;
  const v322Epd = parseV322ElectricalPowerRepositoryIfExists(path);
  if (v322Epd) return v322Epd;
  const v323Fls = parseV323FireLsaSafetyRepositoryIfExists(path);
  if (v323Fls) return v323Fls;
  const v321Env = parseV321EnvironmentalMachineryRepositoryIfExists(path);
  if (v321Env) return v321Env;
  const v320Igs = parseV320InertGasRepositoryIfExists(path);
  if (v320Igs) return v320Igs;
  const v316Pump = parseV316ShipboardPumpsRepositoryIfExists(path);
  if (v316Pump) return v316Pump;
  const v317Hex = parseV317HeatExchangersRepositoryIfExists(path);
  if (v317Hex) return v317Hex;
  const v315Pcs = parseV315PurifiersRepositoryIfExists(path);
  if (v315Pcs) return v315Pcs;
  const v310Stg = parseV310SteeringGearRepositoryIfExists(path);
  if (v310Stg) return v310Stg;
  const v311Dmk = parseV311DeckMachineryRepositoryIfExists(path);
  if (v311Dmk) return v311Dmk;
  const v314Emo = parseV314ElectricalMotorsRepositoryIfExists(path);
  if (v314Emo) return v314Emo;
  const v39Cas = parseV39CompressedAirRepositoryIfExists(path);
  if (v39Cas) return v39Cas;
  const v312 = parseV312IncrementalRepositoryIfExists(path);
  if (v312) return v312;
  const v311 = parseV311IncrementalRepositoryIfExists(path);
  if (v311) return v311;
  const v310 = parseV310IncrementalRepositoryIfExists(path);
  if (v310) return v310;
  const v39 = parseV39IncrementalRepositoryIfExists(path);
  if (v39) return v39;
  const v38 = parseV38IncrementalRepositoryIfExists(path);
  if (v38) return v38;
  const parsed = parseV3MasterRepositoryFileIfExists(path);
  if (!parsed) throw new Error(`Failed to parse EMDR master repository: ${path}`);
  return parsed;
}
