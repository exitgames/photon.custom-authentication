// --------------------------------------------------------------------------------------------------------------------
// <copyright file="ClientController.cs" company="Exit Games GmbH">
//   Copyright (c) Exit Games GmbH.  All rights reserved.
// </copyright>
// <summary>
//   Defines the ClientController type.
// </summary>
// --------------------------------------------------------------------------------------------------------------------

namespace ExitGames.Web.Sample.Controllers
{
    using System.Web.Mvc;

    using ExitGames.Web.Sample.Models;
    using ExitGames.Web.Sample.Services;

    // TODO be sure to use SSL in production
    //[RequireHttps]
    public class ClientController : AsyncController
    {
        public ClientController()
            : this(null)
        {
        }

        public ClientController(IClientAuthenticationService authenticationService)
        {
            this.AuthenticationService = authenticationService ?? new ClientAuthenticationService();
        }

        public IClientAuthenticationService AuthenticationService { get; private set; }

        public ActionResult Authenticate(string userName, string token)
        {
            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(token))
            {
                var resultErrorInput = new Result { ResultCode = 2, Message = "Parameter invalid" };
                JsonResult resultErrorInputJson = this.Json(resultErrorInput, JsonRequestBehavior.AllowGet);
                return resultErrorInputJson;
            }

            bool authenticated = this.AuthenticationService.Authenticate(userName, token);
            if (authenticated)
            {
                var resultOk = new Result { ResultCode = 1 };
                JsonResult resultOkJson = this.Json(resultOk, JsonRequestBehavior.AllowGet);
                return resultOkJson;
            }

            // authentication failed
            var resultError = new Result
            {
                ResultCode = 2,
                ////Message = "whatever reason"
            };
            JsonResult resultErrorJson = this.Json(resultError, JsonRequestBehavior.AllowGet);
            return resultErrorJson;
        }
    }
}
