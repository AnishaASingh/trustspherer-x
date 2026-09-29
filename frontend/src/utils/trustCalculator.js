// Deterministic Trust Analysis Engine for TrustSphere

// Simple hash generator for deterministic mock metrics
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Map score to classification & color
export function getTrustLevel(score) {
  if (score === null || score === undefined || score === '' || Number.isNaN(Number(score))) {
    return {
      level: "Awaiting verification",
      risk: "N/A",
      status: "AWAITING VERIFICATION",
      color: "var(--text-muted)",
      badgeClass: "badge-medium"
    };
  }
  const numScore = Number(score);
  if (numScore >= 90) {
    return {
      level: "Highly Trusted",
      risk: "LOW",
      status: "VERIFIED",
      color: "var(--trust-90)",
      badgeClass: "badge-highly-trusted"
    };
  }
  if (score >= 75) {
    return {
      level: "Trusted",
      risk: "LOW",
      status: "VERIFIED",
      color: "var(--trust-75)",
      badgeClass: "badge-trusted"
    };
  }
  if (score >= 60) {
    return {
      level: "Medium Risk",
      risk: "MEDIUM",
      status: "UNDER REVIEW",
      color: "var(--trust-60)",
      badgeClass: "badge-medium"
    };
  }
  if (score >= 40) {
    return {
      level: "High Risk",
      risk: "HIGH",
      status: "FLAGGED",
      color: "var(--trust-40)",
      badgeClass: "badge-high"
    };
  }
  return {
    level: "Critical Risk",
    risk: "CRITICAL",
    status: "REJECTED",
    color: "var(--trust-0)",
    badgeClass: "badge-critical"
  };
}

// Calculate deterministic evaluation for an asset
export function analyzeAsset({ name, size, type, department, source }) {
  const seedString = `${name.toLowerCase()}_${size}_${type}_${department}`;
  const seed = hashString(seedString);

  // Check for trigger keywords to make demonstrations intuitive
  const lowerName = name.toLowerCase();
  const isSuspiciousUrgent = lowerName.includes('urgent') || lowerName.includes('password') || lowerName.includes('hack') || lowerName.includes('phish');
  const isSuspiciousWire = lowerName.includes('wire') || lowerName.includes('tamper') || lowerName.includes('bypass') || lowerName.includes('leak');
  const isCleanCert = lowerName.includes('cert') || lowerName.includes('ssl') || lowerName.includes('audit') || lowerName.includes('signed');

  let baseScore;
  if (isSuspiciousUrgent) {
    baseScore = 20 + (seed % 18); // 20 - 37 (Critical)
  } else if (isSuspiciousWire) {
    baseScore = 42 + (seed % 16); // 42 - 57 (High Risk)
  } else if (isCleanCert) {
    baseScore = 91 + (seed % 9);  // 91 - 99 (Highly Trusted)
  } else {
    // Normal distribution leaning towards trusted (70 - 95)
    baseScore = 70 + (seed % 26);
  }

  const { level, risk, status, color, badgeClass } = getTrustLevel(baseScore);

  // Derive sub-factor scores around base score
  const sourceReliability = Math.min(99, Math.max(15, baseScore + ((seed % 11) - 5)));
  const integrity = Math.min(99, Math.max(20, baseScore + (((seed >> 2) % 13) - 6)));
  const contentConsistency = Math.min(99, Math.max(10, baseScore + (((seed >> 4) % 15) - 7)));
  const metadataScore = Math.min(99, Math.max(25, baseScore + (((seed >> 6) % 11) - 5)));
  const historicalBehaviour = Math.min(99, Math.max(30, baseScore + (((seed >> 8) % 9) - 4)));

  // Verification checks based on performance
  const checks = [
    {
      name: "File Integrity",
      passed: integrity >= 60,
      detail: integrity >= 60 
        ? "Cryptographic SHA-256 matches verified block distribution."
        : "Byte-offset alteration detected within document trailer."
    },
    {
      name: "Source Verification",
      passed: sourceReliability >= 60,
      detail: sourceReliability >= 60
        ? `Validated origin channel [${source || 'Corporate Gateway'}].`
        : "Unverified outbound proxy or anomalous DNS SPF alignment."
    },
    {
      name: "Metadata Validation",
      passed: metadataScore >= 60,
      detail: metadataScore >= 60
        ? "Creation timestamps and software signatures consistent."
        : "Exif/XMP timestamp mismatch indicates post-creation editing."
    },
    {
      name: "Content Consistency",
      passed: contentConsistency >= 60,
      detail: contentConsistency >= 60
        ? "Structural patterns match approved departmental schema."
        : "Irregular character encoding or unusual external hyperlink injection."
    }
  ];

  // Anomalies and recommendations
  const anomalies = [];
  if (integrity < 60) {
    anomalies.push("Cryptographic hash mismatch after digital certificate sealing.");
  }
  if (sourceReliability < 60) {
    anomalies.push("Originating IP address is not within organization trusted boundary.");
  }
  if (metadataScore < 60) {
    anomalies.push("Metadata modification timestamp is newer than document author stamp.");
  }
  if (contentConsistency < 60) {
    anomalies.push("Heuristic content scan detected suspicious obfuscation patterns.");
  }

  const recommendations = [];
  if (risk === "CRITICAL") {
    recommendations.push("Quarantine asset immediately from corporate distribution.");
    recommendations.push("Revoke temporary tokens associated with the upload session.");
    recommendations.push("Trigger automated incident response ticket for IT Security team.");
  } else if (risk === "HIGH") {
    recommendations.push("Initiate secondary dual-custody verification with departmental lead.");
    recommendations.push("Hold downstream ERP payment/processing batch until approval.");
    recommendations.push("Request out-of-band cryptographic signature validation.");
  } else if (risk === "MEDIUM") {
    recommendations.push("Review modified metadata stamps with asset author.");
    recommendations.push("Verify departmental routing policy compliance.");
  } else {
    recommendations.push("Digital asset meets enterprise trust governance standards.");
    recommendations.push("Archive in high-durability secure storage vault.");
  }

  // Pseudo SHA-256 hash
  const pseudoHash = "sha256:" + Array.from({ length: 64 }, (_, i) => 
    ((seed ^ (i * 37)) % 16).toString(16)
  ).join("");

  return {
    trustScore: baseScore,
    level,
    risk,
    status,
    color,
    badgeClass,
    hash: pseudoHash,
    factors: {
      sourceReliability,
      integrity,
      contentConsistency,
      metadata: metadataScore,
      historicalBehaviour
    },
    checks,
    anomalies,
    recommendations
  };
}
