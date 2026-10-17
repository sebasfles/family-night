data "archive_file" "api_bootstrap" {
  type        = "zip"
  output_path = "${path.module}/.bootstrap/api.zip"

  source {
    filename = "index.mjs"
    content  = <<-JS
      export const handler = async () => ({
        statusCode: 503,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ error: 'not deployed yet' }),
      });
    JS
  }
}

data "archive_file" "events_auth_bootstrap" {
  type        = "zip"
  output_path = "${path.module}/.bootstrap/events-auth.zip"

  source {
    filename = "index.mjs"
    content  = "export const handler = async () => ({ isAuthorized: false });\n"
  }
}

locals {
  table_env = { for key, table in module.tables : "${upper(key)}_TABLE" => table.name }
}

module "api" {
  source = "../../modules/aws/lambda_function"

  name          = "${local.name_prefix}-api"
  bootstrap_zip = data.archive_file.api_bootstrap.output_path
  function_url  = true

  environment = merge(local.table_env, {
    EVENTS_HTTP_DOMAIN = module.events.http_domain
    NODE_OPTIONS       = "--enable-source-maps"
  })

  policy_statements = {
    read_write_tables = {
      actions = [
        "dynamodb:GetItem",
        "dynamodb:BatchGetItem",
        "dynamodb:Query",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:ConditionCheckItem",
      ]
      resources = [for table in module.tables : table.arn]
    }

    publish_rooms = {
      actions   = ["appsync:EventPublish"]
      resources = [module.events.namespace_arns["rooms"]]
    }
  }
}

module "events_auth" {
  source = "../../modules/aws/lambda_function"

  name          = "${local.name_prefix}-events-auth"
  bootstrap_zip = data.archive_file.events_auth_bootstrap.output_path

  environment = {
    PLAYERS_TABLE      = module.tables["players"].name
    ROOM_MEMBERS_TABLE = module.tables["room_members"].name
    NODE_OPTIONS       = "--enable-source-maps"
  }

  policy_statements = {
    read_identity = {
      actions   = ["dynamodb:GetItem"]
      resources = [module.tables["players"].arn, module.tables["room_members"].arn]
    }
  }
}
