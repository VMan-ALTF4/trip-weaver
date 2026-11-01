# English and Vietnamese language switching

## What will change
- Add a site-wide language setting with English and Vietnamese choices.
- Keep the selected language while visitors move between pages and when they return later.
- Translate every visitor-facing page: home, tours, tour details, checkout, booking confirmation, password reset, account window, header, footer, route map, and administration area.
- Translate all tour content, filters, pickup points, booking steps, messages, buttons, labels, errors, and page metadata.
- Update displayed number, date, currency, and plural wording where appropriate for the selected language.

## Experience
- The existing language menu becomes functional and offers English and Tiếng Việt only.
- Switching languages updates the current screen immediately without navigating away or losing entered booking information.
- Mobile and desktop menus show the same selected language.
- English remains the initial language for first-time visitors; the saved preference takes priority afterward.

## Technical details
- Add a lightweight React language provider and typed translation dictionaries, avoiding a new dependency.
- Store stable data identifiers separately from translated labels so filters and booking calculations continue to work in both languages.
- Provide localized tour and pickup content through translation helpers while preserving IDs, prices, and saved booking values.
- Set the document language attribute and localized metadata when the language changes.
- Verify the main booking flow and language persistence in both desktop and mobile-sized previews.
