module "events" {
  source = "../../modules/aws/appsync_events"

  name                     = "${local.name_prefix}-events"
  namespaces               = ["rooms"]
  authorizer_function_name = module.events_auth.name
  authorizer_function_arn  = module.events_auth.arn
}
