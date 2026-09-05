# Coaching stories: editorial scope

Sources consulted on 5 September 2026 BDT. Each expanded story includes its own
reading links in the application. Text is written for this coach, not copied from
the source pages. Advice explains the detected idea; it is not a claim that the
engine has proved the move sound or reproduced a historical game.

`src/coach/openingStories.ts` adds explicitly labelled family context to the 185
preserved, variation-specific opening records. The most specific matching move
prefix wins. Family context remains available after leaving the book. Reading
includes Chess.com's opening guides, Bryan Smith's history of the Modern Defense
and the historical overview of the Torre Attack.

`src/coach/stories.ts` supplies all 27 existing motif categories with historical
connections, practical mechanisms, counterplay and reading. Named examples include
Petrosian–Spassky (fork), Panno–Mecking (pin), Nakamura–Shabalov (discovered attack),
Réti–Tartakower 1910 (double check), Gligorić–Fischer (back-rank restraint),
Anderssen–Kieseritzky 1851 (sacrifice), Capablanca–Golombek 1939 and Karpov–Lautier
(minority attack), and the Saavedra study of 1895 (underpromotion).

Strategic connections include Nimzowitsch's *My System* and the hypermodern school.
Where the consulted reference establishes examples or instruction but not an
inventor, the story does not invent one. The Immortal Game note acknowledges that
the famous published continuation is not uniform across historical accounts.

The expanded motif prose supersedes the original displayed prose, which remains
unchanged in `motifs.ts` and the preserved references. This avoids showing old
absolute or unverified claims alongside the more careful explanations, such as
every pinned piece being immobile or assigning a precise inventor to a skewer.
Opening-specific original prose remains visible alongside labelled family context.

Reading links open a separate tab with `noopener noreferrer`. Story text is bundled
for offline guest use; following external reading links requires an internet connection.
The full move-story list is reconstructed from the saved legal game history.
Expanded/collapsed choices survive subsequent moves in the mounted game; after
reopening the app the opening starts expanded and move cards start collapsed.

The source catalog is deliberately finite. Quiet moves with no recognized motif do
not receive an invented historical story. The detector, opening engine, rating
policy and private record format are unchanged.
