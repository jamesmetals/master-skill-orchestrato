import path from "node:path";
import fs from "fs-extra";
import YAML from "yaml";

export interface SkillDescriptor {
  name: string;
  description: string;
  rootDir: string;
  skillFile: string;
  relativePath: string;
}

export function getSkillDestination(
  skill: SkillDescriptor,
  destinationSkillsDir: string,
): string {
  return path.join(destinationSkillsDir, skill.relativePath);
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);

  if (!match) {
    return {};
  }

  return (YAML.parse(match[1]) as Record<string, unknown>) ?? {};
}

function collectSkillFiles(baseDir: string): string[] {
  const skillFiles: string[] = [];

  for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
    const entryPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      skillFiles.push(...collectSkillFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name === "SKILL.md") {
      skillFiles.push(entryPath);
    }
  }

  return skillFiles;
}

export function listSkills(externalSkillsDir: string): SkillDescriptor[] {
  if (!fs.existsSync(externalSkillsDir)) {
    throw new Error(`External skills directory not found: ${externalSkillsDir}`);
  }

  return collectSkillFiles(externalSkillsDir)
    .map((skillFile) => {
      const rootDir = path.dirname(skillFile);
      const relativePath = path.relative(externalSkillsDir, rootDir);
      const content = fs.readFileSync(skillFile, "utf8");
      const metadata = parseFrontmatter(content);

      return {
        name: String(metadata.name ?? path.basename(rootDir)),
        description: String(metadata.description ?? "").trim(),
        rootDir,
        skillFile,
        relativePath,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function findSkillMatches(
  skills: SkillDescriptor[],
  query: string,
): SkillDescriptor[] {
  const normalized = query.trim().toLowerCase();

  return skills.filter((skill) => {
    const haystack = [
      skill.name,
      skill.description,
      skill.relativePath,
      skill.skillFile,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}

export function installSkill(
  skill: SkillDescriptor,
  destinationSkillsDir: string,
  force = false,
): string {
  const destination = getSkillDestination(skill, destinationSkillsDir);

  fs.ensureDirSync(destinationSkillsDir);

  if (fs.existsSync(destination) && !force) {
    throw new Error(
      `Destination already exists: ${destination}. Re-run with --force to overwrite.`,
    );
  }

  fs.copySync(skill.rootDir, destination, {
    overwrite: force,
    errorOnExist: !force,
  });

  return destination;
}
