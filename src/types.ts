export type FoodShop = {
  id: string;
  name: string;
  address?: string;
  distance?: number;
  type?: string;
  location?: string;
  rating?: string;
  cost?: string;
};

export type NearbyFoodRequest = {
  lat: number;
  lng: number;
  radius?: number;
};

export type NearbyFoodResponse = {
  shops: FoodShop[];
};
