/**
 * Compliance evidence is not authorisation. This register is intentionally
 * fail-closed; no provider is approved for AwehBet public game launches.
 * Re-verify primary evidence before treating any claim as current.
 */
export type VerificationState = 'unverified' | 'evidence_found' | 'verified' | 'restricted';
export type ProviderVerification = {
 provider: string;
 saLicenceEvidence: string;
 licenceStatus: VerificationState;
 gameCertification: VerificationState;
 operatorEligibility: VerificationState;
 distributionRights: VerificationState;
 demoPermission: VerificationState;
 technicalValidation: VerificationState;
 source: string;
 verificationDate: string;
 activationStatus: 'blocked' | 'approved';
};
export const providerVerifications: readonly ProviderVerification[] = [
  {
    "provider": "Pragmatic Play",
    "saLicenceEvidence": "SA operator partnerships publicly reported; licence number unverified",
    "licenceStatus": "unverified",
    "gameCertification": "unverified",
    "operatorEligibility": "unverified",
    "distributionRights": "unverified",
    "demoPermission": "unverified",
    "technicalValidation": "unverified",
    "source": "https://www.pragmaticplay.com/",
    "verificationDate": "2026-10-21",
    "activationStatus": "blocked"
  },
  {
    "provider": "Hacksaw Gaming",
    "saLicenceEvidence": "SA operator partnerships publicly reported; licence number unverified",
    "licenceStatus": "unverified",
    "gameCertification": "unverified",
    "operatorEligibility": "unverified",
    "distributionRights": "unverified",
    "demoPermission": "unverified",
    "technicalValidation": "unverified",
    "source": "https://www.hacksawgaming.com/",
    "verificationDate": "2026-10-21",
    "activationStatus": "blocked"
  },
  {
    "provider": "Evolution",
    "saLicenceEvidence": "National Manufacturer licence publicly announced; current scope/status to verify",
    "licenceStatus": "evidence_found",
    "gameCertification": "unverified",
    "operatorEligibility": "unverified",
    "distributionRights": "unverified",
    "demoPermission": "unverified",
    "technicalValidation": "unverified",
    "source": "https://www.evolution.com/",
    "verificationDate": "2026-10-21",
    "activationStatus": "blocked"
  },
  {
    "provider": "Play'n GO",
    "saLicenceEvidence": "Western Cape Certificate of Suitability publicly reported; scope/status to verify",
    "licenceStatus": "evidence_found",
    "gameCertification": "unverified",
    "operatorEligibility": "unverified",
    "distributionRights": "unverified",
    "demoPermission": "unverified",
    "technicalValidation": "unverified",
    "source": "https://www.playngo.com/",
    "verificationDate": "2026-10-21",
    "activationStatus": "blocked"
  },
  {
    "provider": "Games Global",
    "saLicenceEvidence": "SA operator presence reported; supplier approval unverified",
    "licenceStatus": "unverified",
    "gameCertification": "unverified",
    "operatorEligibility": "unverified",
    "distributionRights": "unverified",
    "demoPermission": "unverified",
    "technicalValidation": "unverified",
    "source": "https://www.gamesglobal.com/",
    "verificationDate": "2026-10-21",
    "activationStatus": "blocked"
  },
  {
    "provider": "Gaming Realms",
    "saLicenceEvidence": "SA distribution via Hollywoodbets/Light & Wonder reported; approval unverified",
    "licenceStatus": "unverified",
    "gameCertification": "unverified",
    "operatorEligibility": "unverified",
    "distributionRights": "unverified",
    "demoPermission": "unverified",
    "technicalValidation": "unverified",
    "source": "https://gamingrealms.com/",
    "verificationDate": "2026-10-21",
    "activationStatus": "blocked"
  }
] as const;
export function providerMayLaunch(record: ProviderVerification): boolean {
 return record.activationStatus === 'approved'
   && record.licenceStatus === 'verified'
   && record.gameCertification === 'verified'
   && record.operatorEligibility === 'verified'
   && record.distributionRights === 'verified'
   && record.demoPermission === 'verified'
   && record.technicalValidation === 'verified';
}
