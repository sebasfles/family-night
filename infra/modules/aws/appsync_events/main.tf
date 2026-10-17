resource "aws_appsync_api" "this" {
  name = var.name

  event_config {
    auth_provider {
      auth_type = "AWS_LAMBDA"

      lambda_authorizer_config {
        authorizer_uri                   = var.authorizer_function_arn
        authorizer_result_ttl_in_seconds = var.authorizer_result_ttl_seconds
      }
    }

    auth_provider {
      auth_type = "AWS_IAM"
    }

    connection_auth_mode {
      auth_type = "AWS_LAMBDA"
    }

    default_subscribe_auth_mode {
      auth_type = "AWS_LAMBDA"
    }

    default_publish_auth_mode {
      auth_type = "AWS_IAM"
    }
  }

  tags = { Name = var.name }
}

resource "aws_appsync_channel_namespace" "this" {
  for_each = toset(var.namespaces)

  api_id = aws_appsync_api.this.api_id
  name   = each.value

  subscribe_auth_mode {
    auth_type = "AWS_LAMBDA"
  }

  publish_auth_mode {
    auth_type = "AWS_IAM"
  }

  tags = { Name = "${var.name}-${each.value}" }
}

resource "aws_lambda_permission" "authorizer" {
  statement_id  = "AllowAppSyncEventsAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = var.authorizer_function_name
  principal     = "appsync.amazonaws.com"
  source_arn    = aws_appsync_api.this.api_arn
}
