// --------------------------------------------------------------------------------------------------------------------
// <copyright file="WebApiConfig.cs" company="Exit Games GmbH">
//   Copyright (c) Exit Games GmbH.  All rights reserved.
// </copyright>
// <summary>
//   Defines the WebApiConfig type.
// </summary>
// --------------------------------------------------------------------------------------------------------------------

namespace ExitGames.Web.Sample
{
    using System.Linq;
    using System.Web.Http;

    public static class WebApiConfig
    {
        public static void Register(HttpConfiguration config)
        {
            config.Routes.MapHttpRoute(
                name: "Authenticate",
                routeTemplate: "api/client/authenticate/{userName}/{token}",
                defaults: new { controller = "Client", action = "Authenticate" });
            config.Routes.MapHttpRoute(
                name: "Authenticate2",
                routeTemplate: "client/authenticate/{userName}/{token}",
                defaults: new { controller = "Client", action = "Authenticate" });

            config.Routes.MapHttpRoute(
                name: "DefaultApi",
                routeTemplate: "api/{controller}/{id}",
                defaults: new { id = RouteParameter.Optional });
            config.Routes.MapHttpRoute(
                name: "DefaultApi2",
                routeTemplate: "{controller}/{id}",
                defaults: new { id = RouteParameter.Optional });

            // return JSON by default - to get XML add the "text/xml" accept header at the client request
            var appXmlType = config.Formatters.XmlFormatter.SupportedMediaTypes.FirstOrDefault(t => t.MediaType == "application/xml");
            config.Formatters.XmlFormatter.SupportedMediaTypes.Remove(appXmlType);
        }
    }
}