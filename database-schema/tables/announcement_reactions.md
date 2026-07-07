# announcement_reactions

Per-user emoji reactions for announcements.

| column | type | nullable | notes |
| --- | --- | --- | --- |
| id | bigint | no | Identity primary key |
| announcement_id | bigint | no | References `announcements.id`, cascades on delete |
| user_id | uuid | no | References `profiles.id`, cascades on delete |
| emoji | text | no | Short emoji value |
| created_at | timestamptz | no | Defaults to `now()` |

Constraints:
- Unique reaction per `(announcement_id, user_id, emoji)`.
- `emoji` length must be between 1 and 16 characters.

Access:
- Authenticated users can view reactions.
- Authenticated users can add or remove only their own reactions.
