export type TagStance = "support" | "oppose" | "neutral";

export type PoliticalTagRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
};

export type UserTagPreferenceRow = {
  tag_id: string;
  stance: TagStance;
};
