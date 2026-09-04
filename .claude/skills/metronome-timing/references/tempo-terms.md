# Italian tempo markings and BPM ranges

| Marking | BPM | Character |
|---|---|---|
| Grave | 20–40 | Very slow, solemn |
| Largo | 40–60 | Broad |
| Lento | 45–60 | Slow |
| Larghetto | 60–66 | Rather broad |
| Adagio | 66–76 | Slow, at ease |
| Adagietto | 70–80 | Slightly faster than adagio |
| Andante | 76–108 | Walking pace |
| Andantino | 80–108 | Slightly faster than andante |
| Moderato | 108–120 | Moderate |
| Allegretto | 112–120 | Moderately fast |
| Allegro | 120–168 | Fast, cheerful |
| Vivace | 140–176 | Lively |
| Presto | 168–200 | Very fast |
| Prestissimo | 200+ | As fast as possible |

## The ranges overlap on purpose

Andante's top overlaps Moderato; Allegro and Vivace share most of their territory.
This is not sloppiness in the sources — these terms describe **character** as much as
speed. *Vivace* at 150 asks for a different articulation than *Allegro* at 150.

Consequence for the implementation: **BPM → term is a lossy, one-way mapping.** Pick a
single non-overlapping partition for the display label and document that it is
approximate. Do not build a term → BPM picker that pretends to be authoritative.

## Suggested display partition (non-overlapping, for the BPM readout)

| BPM | Label shown |
|---|---|
| < 40 | Grave |
| 40–59 | Largo |
| 60–65 | Larghetto |
| 66–75 | Adagio |
| 76–107 | Andante |
| 108–119 | Moderato |
| 120–139 | Allegro |
| 140–167 | Vivace |
| 168–199 | Presto |
| ≥ 200 | Prestissimo |

Implement as a sorted array of `{ minBpm, label }` and find the last entry whose
`minBpm <= bpm`. That is a 10-line pure function with an obvious unit test — assert the
boundaries (39/40, 119/120, 199/200) explicitly, since off-by-one at a boundary is the
only bug this function can have.
