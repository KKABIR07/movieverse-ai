CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"user_initials" text NOT NULL,
	"color" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_room_id_ck" CHECK ("chat_messages"."room_id" in ('general', 'movies', 'tv-shows', 'recommendations', 'spoilers')),
	CONSTRAINT "chat_text_ck" CHECK (char_length("chat_messages"."text") between 1 and 500),
	CONSTRAINT "chat_user_name_ck" CHECK (char_length("chat_messages"."user_name") <= 60),
	CONSTRAINT "chat_user_initials_ck" CHECK (char_length("chat_messages"."user_initials") <= 4),
	CONSTRAINT "chat_color_ck" CHECK (char_length("chat_messages"."color") <= 16)
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"user_id" uuid NOT NULL,
	"person_id" integer NOT NULL,
	"person_name" text NOT NULL,
	"person_image" text,
	"department" text DEFAULT 'Acting' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_pkey" PRIMARY KEY("user_id","person_id"),
	CONSTRAINT "follows_person_id_ck" CHECK ("follows"."person_id" > 0),
	CONSTRAINT "follows_person_name_ck" CHECK (char_length("follows"."person_name") between 1 and 200),
	CONSTRAINT "follows_person_image_ck" CHECK (char_length("follows"."person_image") <= 200),
	CONSTRAINT "follows_department_ck" CHECK (char_length("follows"."department") <= 50)
);
--> statement-breakpoint
CREATE TABLE "review_likes" (
	"review_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "review_likes_pkey" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" integer NOT NULL,
	"movie_title" text NOT NULL,
	"movie_poster" text,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"content" text NOT NULL,
	"spoiler" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_movie_key" UNIQUE("user_id","movie_id"),
	CONSTRAINT "reviews_movie_id_ck" CHECK ("reviews"."movie_id" > 0),
	CONSTRAINT "reviews_rating_ck" CHECK ("reviews"."rating" between 1 and 10),
	CONSTRAINT "reviews_content_ck" CHECK (char_length("reviews"."content") between 1 and 2000),
	CONSTRAINT "reviews_movie_title_ck" CHECK (char_length("reviews"."movie_title") between 1 and 300),
	CONSTRAINT "reviews_movie_poster_ck" CHECK (char_length("reviews"."movie_poster") <= 200)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar" text,
	"initials" text NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_email_ck" CHECK ("users"."email" = lower("users"."email") and char_length("users"."email") between 3 and 254),
	CONSTRAINT "users_name_ck" CHECK (char_length("users"."name") between 1 and 60),
	CONSTRAINT "users_initials_ck" CHECK (char_length("users"."initials") <= 4),
	CONSTRAINT "users_avatar_ck" CHECK (char_length("users"."avatar") <= 500),
	CONSTRAINT "users_password_hash_ck" CHECK (char_length("users"."password_hash") <= 255),
	CONSTRAINT "users_token_version_ck" CHECK ("users"."token_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"user_id" uuid NOT NULL,
	"media_type" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"title" text,
	"name" text,
	"poster_path" text,
	"backdrop_path" text,
	"vote_average" real DEFAULT 0 NOT NULL,
	"release_date" text,
	"first_air_date" text,
	"added_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_items_pkey" PRIMARY KEY("user_id","media_type","tmdb_id"),
	CONSTRAINT "watchlist_media_type_ck" CHECK ("watchlist_items"."media_type" in ('movie', 'tv')),
	CONSTRAINT "watchlist_tmdb_id_ck" CHECK ("watchlist_items"."tmdb_id" > 0),
	CONSTRAINT "watchlist_vote_average_ck" CHECK ("watchlist_items"."vote_average" between 0 and 10),
	CONSTRAINT "watchlist_title_ck" CHECK (char_length("watchlist_items"."title") <= 300),
	CONSTRAINT "watchlist_name_ck" CHECK (char_length("watchlist_items"."name") <= 300),
	CONSTRAINT "watchlist_poster_path_ck" CHECK (char_length("watchlist_items"."poster_path") <= 200),
	CONSTRAINT "watchlist_backdrop_path_ck" CHECK (char_length("watchlist_items"."backdrop_path") <= 200),
	CONSTRAINT "watchlist_release_date_ck" CHECK (char_length("watchlist_items"."release_date") <= 40),
	CONSTRAINT "watchlist_first_air_date_ck" CHECK (char_length("watchlist_items"."first_air_date") <= 40)
);
--> statement-breakpoint
CREATE TABLE "youtube_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "youtube_cache_key_ck" CHECK (char_length("youtube_cache"."key") <= 200)
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_likes" ADD CONSTRAINT "review_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_room_created_idx" ON "chat_messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "follows_person_idx" ON "follows" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "reviews_movie_created_idx" ON "reviews" USING btree ("movie_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "watchlist_items_user_added_idx" ON "watchlist_items" USING btree ("user_id","added_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "youtube_cache_expires_idx" ON "youtube_cache" USING btree ("expires_at");