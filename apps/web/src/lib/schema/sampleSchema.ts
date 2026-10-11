/**
 * 首頁 hero 跟工作區空狀態共用的範例 schema（跟 examples/blog.dbschema 同一份內容）。
 * 五張表、兩個群組、五條關聯：夠小一眼看得完，又剛好能示範 Focus、群組色跟 1/N 標記。
 */
export const SAMPLE_SCHEMA_FILENAME = 'blog-sample.dbschema';

export const SAMPLE_SCHEMA_DSL = `group Identity "使用者與身分"
group Content  "文章、留言與標籤"

table Users "系統使用者" in Identity {
  PK Id          bigint        not null "使用者 ID"
  UQ Email       nvarchar(255) not null "登入 Email"
     DisplayName nvarchar(100) null     "顯示名稱"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}

table Posts "文章" in Content {
  PK Id        bigint         not null "文章 ID"
  FK AuthorId  bigint         not null "作者，指向 Users"
     Title     nvarchar(200)  not null "文章標題"
     Status    nvarchar(20)   not null default "draft" "draft / published"
     CreatedAt datetime2      not null "發表時間"
}

table Comments "留言" in Content {
  PK Id        bigint         not null "留言 ID"
  FK PostId    bigint         not null "所屬文章"
  FK AuthorId  bigint         not null "留言者"
     Body      nvarchar(2000) not null "留言內容"
}

table Tags "標籤" in Content {
  PK Id   bigint       not null "標籤 ID"
  UQ Name nvarchar(50) not null "標籤名稱"
}

table PostTags "文章標籤" in Content {
  PK Id     bigint not null "關聯 ID"
  FK PostId bigint not null "文章"
  FK TagId  bigint not null "標籤"
}

index IX_Posts_Author on Posts(AuthorId)
index IX_Comments_Post on Comments(PostId)
index IX_Comments_Author on Comments(AuthorId)
unique index UX_PostTags on PostTags(PostId, TagId)
index IX_PostTags_Tag on PostTags(TagId)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}

relation FK_Comments_Posts {
  Comments.PostId N -> 1 Posts.Id
}

relation FK_Comments_Users {
  Comments.AuthorId N -> 1 Users.Id
}

relation FK_PostTags_Posts {
  PostTags.PostId N -> 1 Posts.Id
}

relation FK_PostTags_Tags {
  PostTags.TagId N -> 1 Tags.Id
}
`;

/** 英文首頁（/en）用的同一份範例，只把說明換成英文。 */
export const SAMPLE_SCHEMA_DSL_EN = `group Identity "Users and identity"
group Content  "Posts, comments and tags"

table Users "App users" in Identity {
  PK Id          bigint        not null "User ID"
  UQ Email       nvarchar(255) not null "Sign-in email"
     DisplayName nvarchar(100) null     "Display name"
     CreatedAt   datetime2     not null default "sysutcdatetime()"
}

table Posts "Blog posts" in Content {
  PK Id        bigint         not null "Post ID"
  FK AuthorId  bigint         not null "Author, points to Users"
     Title     nvarchar(200)  not null "Post title"
     Status    nvarchar(20)   not null default "draft" "draft / published"
     CreatedAt datetime2      not null "Published at"
}

table Comments "Comments" in Content {
  PK Id        bigint         not null "Comment ID"
  FK PostId    bigint         not null "Post it belongs to"
  FK AuthorId  bigint         not null "Comment author"
     Body      nvarchar(2000) not null "Comment text"
}

table Tags "Tags" in Content {
  PK Id   bigint       not null "Tag ID"
  UQ Name nvarchar(50) not null "Tag name"
}

table PostTags "Post-tag link" in Content {
  PK Id     bigint not null "Link ID"
  FK PostId bigint not null "Post"
  FK TagId  bigint not null "Tag"
}

index IX_Posts_Author on Posts(AuthorId)
index IX_Comments_Post on Comments(PostId)
index IX_Comments_Author on Comments(AuthorId)
unique index UX_PostTags on PostTags(PostId, TagId)
index IX_PostTags_Tag on PostTags(TagId)

relation FK_Posts_Users {
  Posts.AuthorId N -> 1 Users.Id
}

relation FK_Comments_Posts {
  Comments.PostId N -> 1 Posts.Id
}

relation FK_Comments_Users {
  Comments.AuthorId N -> 1 Users.Id
}

relation FK_PostTags_Posts {
  PostTags.PostId N -> 1 Posts.Id
}

relation FK_PostTags_Tags {
  PostTags.TagId N -> 1 Tags.Id
}
`;

/** 匯入對話框「填入語法範例」：只示範最小語法——兩張表、一條外鍵關聯。 */
export const SNIPPET_DSL = `table Users {
  PK Id    bigint        not null
     Email nvarchar(255) not null
}

table Orders {
  PK Id     bigint not null
  FK UserId bigint not null
}

relation FK_Orders_Users {
  Orders.UserId N -> 1 Users.Id
}
`;

export const SNIPPET_SQL = `CREATE TABLE users (
  id    bigint PRIMARY KEY,
  email text NOT NULL
);

CREATE TABLE orders (
  id      bigint PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id)
);
`;
