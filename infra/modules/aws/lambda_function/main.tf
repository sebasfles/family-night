resource "aws_cloudwatch_log_group" "this" {
  name              = "/aws/lambda/${var.name}"
  retention_in_days = var.log_retention_days

  tags = { Name = var.name }
}

resource "aws_iam_role" "this" {
  name = var.name

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = var.name }
}

resource "aws_iam_role_policy" "runtime" {
  name = "runtime"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid      = "Logs"
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.this.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "access" {
  count = length(var.policy_statements) > 0 ? 1 : 0

  name = "access"
  role = aws_iam_role.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      for sid, statement in var.policy_statements : {
        Sid      = replace(title(replace(sid, "_", " ")), " ", "")
        Effect   = "Allow"
        Action   = statement.actions
        Resource = statement.resources
      }
    ]
  })
}

resource "aws_lambda_function" "this" {
  function_name = var.name
  role          = aws_iam_role.this.arn
  handler       = "index.handler"
  runtime       = "nodejs24.x"
  architectures = ["arm64"]
  memory_size   = var.memory_size
  timeout       = var.timeout
  filename      = var.bootstrap_zip

  logging_config {
    log_format = "JSON"
    log_group  = aws_cloudwatch_log_group.this.name
  }

  dynamic "environment" {
    for_each = length(var.environment) > 0 ? [var.environment] : []

    content {
      variables = environment.value
    }
  }

  tags = { Name = var.name }

  lifecycle {
    ignore_changes = [filename, source_code_hash, s3_bucket, s3_key, s3_object_version]
  }

  depends_on = [aws_iam_role_policy.runtime, aws_iam_role_policy.access]
}

resource "aws_lambda_function_url" "this" {
  count = var.function_url ? 1 : 0

  function_name      = aws_lambda_function.this.function_name
  authorization_type = "AWS_IAM"
}
