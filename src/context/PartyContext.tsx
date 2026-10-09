import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { errorText, myMemberships, type Membership } from "../lib/parties";

type PartyContextType = {
  memberships: Membership[];
  selected: Membership | null;
  select: (partyId: string) => void;
  refresh: () => Promise<void>;
  loading: boolean;
  error: string;
};

const PartyContext = createContext<PartyContextType | undefined>(undefined);

export function PartyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    try {
      const rows = await myMemberships();
      setMemberships(rows);
      setSelectedId((current) =>
        current && rows.some((row) => row.party.id === current) ? current : rows[0]?.party.id ?? null
      );
      setError("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = memberships.find((row) => row.party.id === selectedId) ?? null;

  return (
    <PartyContext.Provider
      value={{ memberships, selected, select: setSelectedId, refresh, loading, error }}
    >
      {children}
    </PartyContext.Provider>
  );
}

export function useParty() {
  const context = useContext(PartyContext);
  if (!context) throw new Error("useParty must be used within a PartyProvider");
  return context;
}
