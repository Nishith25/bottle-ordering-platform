// customer-app/src/data/products.ts
export type ProductCategory =
  | "Hydrating"
  | "Fruity";

export type Product = {
  id: string;

  // MongoDB document ID returned by the backend
  databaseId?: string;

  name: string;
  shortName: string;
  description: string;
  ingredients: string[];
  sizeMl: number;
  price: number;
  category: ProductCategory;
  imageUrl?: string;
  liquidColor: string;
  cardColor: string;
  accentColor: string;
  subscriptionEligible: boolean;
  available: boolean;
  sortOrder?: number;
};

export const PRODUCTS: Product[] = [
  {
    id: "coconut-chia-refresh",
    name: "Coconut Chia Refresh",
    shortName: "Coconut",
    description:
      "A light and refreshing coconut-water blend with fresh fruit and chia seeds.",
    ingredients: ["Coconut water", "Fresh fruit", "Chia seeds"],
    sizeMl: 300,
    price: 99,
    category: "Hydrating",
    liquidColor: "#DDEDDC",
    cardColor: "#EEF6EE",
    accentColor: "#32694B",
    subscriptionEligible: true,
    available: true,
  },
  {
    id: "cane-chia-splash",
    name: "Cane Chia Splash",
    shortName: "Cane Chia",
    description:
      "Naturally sweet sugarcane juice balanced with fruit pieces and chia seeds.",
    ingredients: ["Sugarcane juice", "Fresh fruit", "Chia seeds"],
    sizeMl: 300,
    price: 89,
    category: "Hydrating",
    liquidColor: "#DCE5A5",
    cardColor: "#F3F6E3",
    accentColor: "#647729",
    subscriptionEligible: true,
    available: true,
  },
  {
    id: "watermelon-splash",
    name: "Watermelon Splash",
    shortName: "Watermelon",
    description:
      "Fresh watermelon juice with juicy fruit pieces and soaked chia seeds.",
    ingredients: ["Watermelon juice", "Fruit pieces", "Chia seeds"],
    sizeMl: 300,
    price: 109,
    category: "Fruity",
    liquidColor: "#EF8F8B",
    cardColor: "#FDECEA",
    accentColor: "#A94443",
    subscriptionEligible: true,
    available: true,
  },
  {
    id: "pineapple-punch",
    name: "Pineapple Punch",
    shortName: "Pineapple",
    description:
      "A bright tropical pineapple drink with fruit pieces and chia seeds.",
    ingredients: ["Pineapple juice", "Fruit pieces", "Chia seeds"],
    sizeMl: 300,
    price: 109,
    category: "Fruity",
    liquidColor: "#F2C957",
    cardColor: "#FFF5D9",
    accentColor: "#8D680C",
    subscriptionEligible: true,
    available: true,
  },
];