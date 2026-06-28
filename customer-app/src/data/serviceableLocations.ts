// customer-app/src/data/serviceableLocations.ts

export type ServiceableLocation = {
  pincode: string;
  area: string;
  city: string;
  active: boolean;
  deliveryFee: number;
  minimumOrder: number;
};

export const SERVICEABLE_LOCATIONS: ServiceableLocation[] = [
  {
    pincode: "500081",
    area: "Madhapur",
    city: "Hyderabad",
    active: true,
    deliveryFee: 39,
    minimumOrder: 99,
  },
  {
    pincode: "500084",
    area: "Kondapur",
    city: "Hyderabad",
    active: true,
    deliveryFee: 39,
    minimumOrder: 99,
  },
  {
    pincode: "500032",
    area: "Gachibowli",
    city: "Hyderabad",
    active: true,
    deliveryFee: 39,
    minimumOrder: 99,
  },
  {
    pincode: "500033",
    area: "Jubilee Hills",
    city: "Hyderabad",
    active: true,
    deliveryFee: 49,
    minimumOrder: 149,
  },
];

export function getServiceableLocation(
  pincode: string
): ServiceableLocation | null {
  return (
    SERVICEABLE_LOCATIONS.find(
      (location) =>
        location.pincode === pincode && location.active
    ) ?? null
  );
}