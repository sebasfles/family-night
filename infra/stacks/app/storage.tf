module "site_bucket" {
  source = "../../modules/aws/s3"

  name                        = local.site_bucket_name
  force_destroy               = true
  cloudfront_distribution_arn = module.cdn.distribution_arn
}

resource "aws_s3_object" "placeholder" {
  bucket        = module.site_bucket.id
  key           = "index.html"
  content_type  = "text/html; charset=utf-8"
  cache_control = "no-cache"
  content       = <<-HTML
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Noche de juegos</title>
      </head>
      <body>
        <h1>Noche de juegos</h1>
        <p>Muy pronto.</p>
      </body>
    </html>
  HTML

  lifecycle {
    ignore_changes = [content, content_type, cache_control, etag, metadata, tags, tags_all]
  }
}
