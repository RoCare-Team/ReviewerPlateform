"use client";

import { useMemo } from "react";
import { Building2, MapPin } from "lucide-react";
import SearchableSelect from "./SearchableSelect";
import { INDIA_STATES } from "../../lib/data/indiaStatesCities";

const STATE_NAMES = INDIA_STATES.map((s) => s.name);

/**
 * State → city cascading picker for India, each half a searchable dropdown
 * (see SearchableSelect). Picking a state resets the city list to that
 * state's cities; picking a state that no longer contains the currently
 * selected city clears it, so the two never end up mismatched.
 *
 * `idPrefix` namespaces the two field ids — needed when several instances
 * render at once (one per row in the multi-location campaign form).
 */
export default function StateCitySelect({ state, city, onStateChange, onCityChange, idPrefix = "sc" }) {
  const cities = useMemo(() => INDIA_STATES.find((s) => s.name === state)?.cities ?? [], [state]);

  function handleStateChange(nextState) {
    onStateChange(nextState);
    const stillValid = INDIA_STATES.find((s) => s.name === nextState)?.cities.includes(city);
    if (!stillValid) onCityChange("");
  }

  return (
    <div className="grid grid-cols-2 gap-2.5">
      <SearchableSelect
        id={`${idPrefix}-state`}
        value={state}
        onChange={handleStateChange}
        options={STATE_NAMES}
        placeholder="State"
        searchPlaceholder="Search states…"
        emptyMessage="No state found."
        icon={MapPin}
      />
      <SearchableSelect
        id={`${idPrefix}-city`}
        value={city}
        onChange={onCityChange}
        options={cities}
        placeholder={state ? "City" : "Pick a state first"}
        searchPlaceholder="Search cities…"
        emptyMessage="No city found."
        icon={Building2}
        disabled={!state}
      />
    </div>
  );
}
