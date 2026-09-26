import {useRef, useState} from 'react';

/** An invoice the request generator reserved, with the program that holds it. */
export interface Reserved {
  readonly programId: string;
  readonly invoiceId: string;
  readonly invoiceAmount: number;
}

/** The invoices the request generator reserved, oldest first, shared with the release generator. */
export interface ReservedInvoices {
  /** For rendering: redraws when the list changes. */
  readonly list: readonly Reserved[];
  /** For async calls: the list as it is now, not as it was at the last render. */
  readonly current: () => readonly Reserved[];
  readonly add: (invoice: Reserved) => void;
  readonly remove: (invoiceId: string) => void;
}

export const useReservedInvoices = (): ReservedInvoices => {
  const latest = useRef<readonly Reserved[]>([]);
  const [list, setList] = useState<readonly Reserved[]>([]);
  const keep = (next: readonly Reserved[]): void => {
    latest.current = next;
    setList(next);
  };
  return {
    list,
    current: () => latest.current,
    add: (invoice) => keep([...latest.current, invoice]),
    remove: (invoiceId) => keep(latest.current.filter((held) => held.invoiceId !== invoiceId)),
  };
};
