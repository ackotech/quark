export type BumpType = "patch" | "minor" | "major" | "new";

export interface PromptResult {
	bump: BumpType;
	frozen: boolean;
	baseVersion: string;
	newVersion: string;
	changelog: string;
}