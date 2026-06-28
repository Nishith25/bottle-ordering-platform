// customer-app/src/hooks/useServiceablePincode.ts

import {
  useCallback,
  useState,
} from "react";

import {
  checkServiceablePincode,
  type PincodeCheckResult,
  type ServiceableLocation,
} from "../services/api";

export function useServiceablePincode() {
  const [checking, setChecking] =
    useState(false);

  const [checked, setChecked] =
    useState(false);

  const [location, setLocation] =
    useState<ServiceableLocation | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [requestError, setRequestError] =
    useState(false);

  const resetPincodeCheck = useCallback(() => {
    setChecked(false);
    setLocation(null);
    setMessage(null);
    setRequestError(false);
  }, []);

  const checkPincode = useCallback(
    async (
      pincode: string
    ): Promise<PincodeCheckResult | null> => {
      setChecking(true);
      setChecked(false);
      setLocation(null);
      setMessage(null);
      setRequestError(false);

      try {
        const result =
          await checkServiceablePincode(
            pincode
          );

        setChecked(true);
        setLocation(result.location);
        setMessage(result.message);

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unable to check this pincode.";

        setChecked(true);
        setLocation(null);
        setMessage(errorMessage);
        setRequestError(true);

        return null;
      } finally {
        setChecking(false);
      }
    },
    []
  );

  return {
    checking,
    checked,
    location,
    message,
    requestError,
    checkPincode,
    resetPincodeCheck,
  };
}