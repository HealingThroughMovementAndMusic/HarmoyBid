import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import QuoteTypeChooser from './QuoteTypeChooser';
import QuotesListScreen from './QuotesListScreen';
import QuoteDocumentScreen from './QuoteDocumentScreen';
import type { Quote, QuoteLineItem, QuoteType } from '@/lib/quotes/quote';

// Internal chooser/list/builder navigation — the same pattern
// src/components/clients/ClientsList.tsx already uses to swap to
// ClientProfile internally. Home.tsx only ever renders <QuotesModule />
// for the "הצעות מחיר" nav item; it never learns about these sub-screens.
type ModuleScreen =
  | { name: 'chooser' }
  | { name: 'list' }
  | { name: 'builder'; quoteType: QuoteType; quoteId: string | null; seedLineItem?: Partial<QuoteLineItem>; seedFields?: Partial<Quote> };

interface QuotesModuleProps {
  initialScreen?: 'chooser' | 'list';
  /** Skip the chooser and open straight into a new quote of this type with
   *  one line item pre-filled — used by "צור הצעת מחיר מחבילה" on an Event
   *  Library package card. seedFields carries quote-level data (e.g.
   *  eventTherapistCount) alongside the line item. */
  initialBuilder?: { quoteType: QuoteType; seedLineItem?: Partial<QuoteLineItem>; seedFields?: Partial<Quote> };
}

export default function QuotesModule({ initialScreen = 'chooser', initialBuilder }: QuotesModuleProps) {
  const [screen, setScreen] = useState<ModuleScreen>(() => {
    if (initialBuilder) {
      return {
        name: 'builder',
        quoteType: initialBuilder.quoteType,
        quoteId: null,
        seedLineItem: initialBuilder.seedLineItem,
        seedFields: initialBuilder.seedFields,
      };
    }
    return initialScreen === 'list' ? { name: 'list' } : { name: 'chooser' };
  });

  const screenNode =
    screen.name === 'builder' ? (
      <QuoteDocumentScreen
        quoteType={screen.quoteType}
        quoteId={screen.quoteId}
        seedLineItem={screen.seedLineItem}
        seedFields={screen.seedFields}
        onBack={() => setScreen({ name: 'chooser' })}
      />
    ) : screen.name === 'list' ? (
      <QuotesListScreen
        onBack={() => setScreen({ name: 'chooser' })}
        onNew={() => setScreen({ name: 'chooser' })}
        onOpen={(quote: Quote) => setScreen({ name: 'builder', quoteType: quote.quoteType, quoteId: quote.id })}
      />
    ) : (
      <QuoteTypeChooser
        onChoose={(quoteType) => setScreen({ name: 'builder', quoteType, quoteId: null })}
        onBrowse={() => setScreen({ name: 'list' })}
      />
    );

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={screen.name}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.18 }}
      >
        {screenNode}
      </motion.div>
    </AnimatePresence>
  );
}
