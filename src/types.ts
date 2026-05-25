export type FoodShop = {
  id: string;
  name: string;
  address?: string;
  distance?: number;
  type?: string;
  location?: string;
  rating?: string;
  cost?: string;
  note?: string;
};

export type SavedShop = FoodShop & {
  savedAt: string;
};

export type FoodCategory = {
  id: string;
  name: string;
  keywords: string[];
};

export type ClassifiedShop = FoodShop & {
  category?: {
    id: string;
    name: string;
    weighted: boolean;
    weight: number;
  };
};

export type NearbyFoodRequest = {
  lat: number;
  lng: number;
  radius?: number;
};

export type NearbyFoodResponse = {
  shops: FoodShop[];
  meta?: {
    fetchedPages: number;
    reachedProviderLimit: boolean;
  };
};

export type CustomShop = SavedShop;

export type CustomGroup = {
  id: string;
  name: string;
  shops: SavedShop[];
  createdAt: string;
  updatedAt: string;
};
